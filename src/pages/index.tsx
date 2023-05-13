import { useCallback, useContext, useState } from "react";
import VrmViewer from "@/components/vrmViewer";
import { ViewerContext } from "@/features/vrmViewer/viewerContext";
import {
  Message,
  textsToScreenplay,
  Screenplay,
} from "@/features/messages/messages";
import { speakCharacter } from "@/features/messages/speakCharacter";
import { MessageInputContainer } from "@/components/messageInputContainer";
import { SYSTEM_PROMPT } from "@/features/constants/systemPromptConstants";
import { KoeiroParam, DEFAULT_PARAM } from "@/features/constants/koeiroParam";
import { getChatResponseStream } from "@/features/chat/openAiChat";
import { M_PLUS_2, Montserrat } from "next/font/google";
import { Introduction } from "@/components/introduction";
import { Menu } from "@/components/menu";
import { GitHubLink } from "@/components/githubLink";
import { Meta } from "@/components/meta";

import { useEffect } from "react";
import { DynamoDBClient, CreateTableCommand, CreateTableCommandInput, PutItemCommand, PutItemCommandInput, QueryCommand, QueryCommandInput } from "@aws-sdk/client-dynamodb";

const AWS_REGION = 'us-west-2';
const dynamoDB = new DynamoDBClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY || ''
  }
});

// 処理するコメントのキュー
let liveCommentQueues: { userName: any; userIconUrl: any; userComment: string; }[] = [];
// YouTube LIVEのコメント取得のページング
let nextPageToken = "";
const INTERVAL_MILL_SECONDS_RETRIEVING_COMMENTS = 20000; // 20秒

const m_plus_2 = M_PLUS_2({
  variable: "--font-m-plus-2",
  display: "swap",
  preload: false,
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  display: "swap",
  subsets: ["latin"],
});

export default function Home() {
  const { viewer } = useContext(ViewerContext);

  const [systemPrompt, setSystemPrompt] = useState(SYSTEM_PROMPT);
  const [openAiKey, setOpenAiKey] = useState("");
  const [youtubeKey, setYoutubeKey] = useState("");
  const [liveId, setLiveId] = useState("");
  const [dynamoTableName, setDynamoTableName] = useState("");
  const [myName, setMyName] = useState("");
  const [otherName, setOtherName] = useState("");
  const [koeiroParam, setKoeiroParam] = useState<KoeiroParam>(DEFAULT_PARAM);
  const [chatProcessing, setChatProcessing] = useState(false);
  const [chatLog, setChatLog] = useState<Message[]>([]);
  const [assistantMessage, setAssistantMessage] = useState("");

  const handleChangeChatLog = useCallback(
    (targetIndex: number, text: string) => {
      const newChatLog = chatLog.map((v: Message, i) => {
        return i === targetIndex ? { role: v.role, content: text } : v;
      });

      setChatLog(newChatLog);
    },
    [chatLog]
  );

  // DynamoDBから最新のメッセージを取得する
  // eslint-disable-next-line react-hooks/exhaustive-deps
  async function getLatestMessageForPartitionKey(partitionKey: string): Promise<string> {
    const queryParams: QueryCommandInput = {
      TableName: dynamoTableName,
      KeyConditionExpression: "#username = :username",
      ExpressionAttributeNames: {
        "#username": "username"
      },
      ExpressionAttributeValues: {
        ":username": { S: partitionKey }
      },
      ScanIndexForward: false,
      Limit: 1
    };
  
    const queryCommand = new QueryCommand(queryParams);
    try {
      const data = await dynamoDB.send(queryCommand);
      if (data.Items && data.Items.length > 0) {
        const latestItem = data.Items[0];
        return latestItem.message.S || ""; // 最新のアイテムの 'message' 属性の値を返す。存在しない場合は空文字列を返す
      }
    } catch (error) {
      console.error(error);
    }
  
    return ""; // データが見つからない場合は空文字列を返す
  }

  // データの保存 (PutItem)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  function putItem(username: string, message: string): void {
    const today = new Date();
    const timestamp = `${today.getFullYear()}${(today.getMonth() + 1)}${today.getDate()}${today.getHours()}${today.getMinutes()}${today.getSeconds()}`;

    const putParams: PutItemCommandInput = {
      TableName: dynamoTableName,
      Item: {
        'username': { S: username },  // 'username' はパーティションキー
        'timestamp': { S: timestamp },  // 'timestamp' は範囲キー
        'message': { S: message }  // 'message' は非キー属性
      }
    };

    const putCommand = new PutItemCommand(putParams);
    dynamoDB.send(putCommand)
      .then((data) => console.log(data))
      .catch((error) => console.error(error));
  }

  /**
   * 文ごとに音声を直列でリクエストしながら再生する
   */
  const handleSpeakAi = useCallback(
    async (
      screenplay: Screenplay,
      onStart?: () => void,
      onEnd?: () => void
    ) => {
      speakCharacter(screenplay, viewer, onStart, onEnd);
    },
    [viewer]
  );

  function createVector(text: string): { [key: string]: number } {
    const wordArray = text.split(' ');
    let wordCount: { [key: string]: number } = {};
  
    for (let word of wordArray) {
      if (wordCount[word]) {
        wordCount[word]++;
      } else {
        wordCount[word] = 1;
      }
    }
  
    return wordCount;
  }
  
  function cosSimilarity(vec1: { [x: string]: number; }, vec2: { [x: string]: number; }) {
    let dotProduct = 0;
    let vec1Magnitude = 0;
    let vec2Magnitude = 0;
  
    for (let word in vec1) {
      if (vec2[word]) {
        dotProduct += vec1[word] * vec2[word];
      }
      vec1Magnitude += vec1[word] * vec1[word];
    }
  
    for (let word in vec2) {
      vec2Magnitude += vec2[word] * vec2[word];
    }
  
    return dotProduct / (Math.sqrt(vec1Magnitude) * Math.sqrt(vec2Magnitude));
  }

  /**
   * アシスタントとの会話を行う
   */
  const handleSendChat = useCallback(
    async (text: string) => {
      if (!openAiKey) {
        setAssistantMessage("APIキーが入力されていません");
        return;
      }

      let newMessage = text;

      if (newMessage == null) return;

      // 会話の近似値が高い場合は話題を変えるように促す
      const vec1 = createVector(chatLog[chatLog.length - 1].content);
      const vec2 = createVector(newMessage);
      if (cosSimilarity(vec1, vec2) > 0.8) {
        newMessage = newMessage + "話題を変えましょう。";
      }

      setChatProcessing(true);
      // ユーザーの発言を追加して表示
      const messageLog: Message[] = [
        ...chatLog,
        { role: "user", content: newMessage },
      ];
      setChatLog(messageLog);

      // Chat GPTへ（プロンプトが長すぎるとエラーになるので最新の10件のみ対象とする）
      const messages: Message[] = [
        {
          role: "system",
          content: systemPrompt,
        },
        ...messageLog.slice(-10),
      ];

      const stream = await getChatResponseStream(messages, openAiKey).catch(
        (e) => {
          console.error(e);
          return null;
        }
      );
      if (stream == null) {
        setChatProcessing(false);
        return;
      }

      const reader = stream.getReader();
      let receivedMessage = "";
      let aiTextLog = "";
      let tag = "";
      const sentences = new Array<string>();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          receivedMessage += value;

          // 返答内容のタグ部分の検出
          const tagMatch = receivedMessage.match(/^\[(.*?)\]/);
          if (tagMatch && tagMatch[0]) {
            tag = tagMatch[0];
            receivedMessage = receivedMessage.slice(tag.length);
          }

          // 返答を一文単位で切り出して処理する
          const sentenceMatch = receivedMessage.match(
            /^(.+[。．！？\n]|.{10,}[、,])/
          );
          if (sentenceMatch && sentenceMatch[0]) {
            const sentence = sentenceMatch[0];
            sentences.push(sentence);
            receivedMessage = receivedMessage
              .slice(sentence.length)
              .trimStart();

            // 発話不要/不可能な文字列だった場合はスキップ
            if (
              !sentence.replace(
                /^[\s\[\(\{「［（【『〈《〔｛«‹〘〚〛〙›»〕》〉』】）］」\}\)\]]+$/g,
                ""
              )
            ) {
              continue;
            }

            const aiText = `${tag} ${sentence}`;
            const aiTalks = textsToScreenplay([aiText], koeiroParam);
            aiTextLog += aiText;

            // 文ごとに音声を生成 & 再生、返答を表示
            const currentAssistantMessage = sentences.join(" ");
            handleSpeakAi(aiTalks[0], () => {
              setAssistantMessage(currentAssistantMessage);
            });
          }
        }
      } catch (e) {
        setChatProcessing(false);
        console.error(e);
      } finally {
        reader.releaseLock();
      }

      // アシスタントの返答をログに追加
      const messageLogAssistant: Message[] = [
        ...messageLog,
        { role: "assistant", content: aiTextLog },
      ];

      // テーブルに保存
      const pattern = /\[(neutral|happy|angry|sad|relaxed)\]/g;
      const modifiedText = aiTextLog.replace(pattern, "");
      putItem(myName, modifiedText)

      setChatLog(messageLogAssistant);
      setChatProcessing(false);
    },
    [openAiKey, chatLog, systemPrompt, putItem, myName, koeiroParam, handleSpeakAi]
  );

  // VIDEO IDからchat IDを取得
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getLiveChatId = async (liveId: string) => {
    const params = {
      part: 'liveStreamingDetails',
      id: liveId,
      key: youtubeKey,
    }
    const query = new URLSearchParams(params)
    const response = await fetch(`https://youtube.googleapis.com/youtube/v3/videos?${query}`, {
      method: 'get',
      headers: {
        'Content-Type': 'application/json'
      },
    })
    const json = await response.json();
    if (json.items.length == 0) {
      return "";
    }
    const liveChatId = json.items[0].liveStreamingDetails.activeLiveChatId
    // return chat ID
    console.log(liveChatId)
    return liveChatId
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const retrieveLiveComments = async (activeLiveChatId: string) => {
    let url = "https://youtube.googleapis.com/youtube/v3/liveChat/messages?liveChatId=" + activeLiveChatId + '&part=authorDetails%2Csnippet&key=' + youtubeKey
    if (nextPageToken !== "") {
      url = url + "&pageToken=" + nextPageToken
    }
    const response = await fetch(url, {
      method: 'get',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    const json = await response.json()
    const items = json.items;
    console.log("items:", items)
    let index = 0
    let currentComments: { userName: any; userIconUrl: any; userComment: any; }[] = []
    nextPageToken = json.nextPageToken;
    items?.forEach(
      (item: { authorDetails: { displayName: any; profileImageUrl: any; }; snippet: { textMessageDetails: { messageText: string; } | undefined; superChatDetails: { userComment: string; } | undefined; }; }) => {
        try {
          const userName = item.authorDetails.displayName
          const userIconUrl = item.authorDetails.profileImageUrl
          let userComment = ""
          if (item.snippet.textMessageDetails != undefined) {
            // 一般コメント
            userComment = item.snippet.textMessageDetails.messageText;
          }
          if (item.snippet.superChatDetails != undefined) {
            // スパチャコメント
            userComment = item.snippet.superChatDetails.userComment;
          }
          const additionalComment = { userName, userIconUrl, userComment }
          if (!liveCommentQueues.includes(additionalComment) && userComment != "") {
            // キューイング
            liveCommentQueues.push(additionalComment)

            // #つきコメントの除外
            additionalComment.userComment.includes("#") || currentComments.push(additionalComment)

            // ユーザーコメントの表示
            let target = document.getElementById("user-comment-box")
            if (target) {
              // 要素を作成します
              const userContainer = document.createElement('div');
              userContainer.classList.add('user-container');
          
              const imageCropper = document.createElement('div');
              imageCropper.classList.add('image-cropper');
          
              const userIcon = document.createElement('img');
              userIcon.classList.add('user-icon');
              userIcon.setAttribute('src', additionalComment.userIconUrl);
          
              const userName = document.createElement('p');
              userName.classList.add('user-name');
              userName.textContent = additionalComment.userName + '：';
          
              const userComment = document.createElement('p');
              userComment.classList.add('user-comment');
              userComment.textContent = additionalComment.userComment;
          
              // 要素を追加します
              imageCropper.appendChild(userIcon);
              userContainer.appendChild(imageCropper);
              userContainer.appendChild(userName);
              userContainer.appendChild(userComment);
              target.prepend(userContainer)
            }
          }
        } catch {
          // Do Nothing
        }
        index = index + 1
      })

      // 読まれてないコメントからランダムに選択
      if (currentComments.length != 0) {
        let { userComment } = currentComments[Math.floor(Math.random() * currentComments.length)]
        return userComment;
      }
      console.log("currentComments:", currentComments);

      return '';
  }

  useEffect(() => {
    const params: CreateTableCommandInput = {
      TableName: dynamoTableName,
      KeySchema: [
          {
              AttributeName: 'username',
              KeyType: 'HASH'
          },
          {
              AttributeName: 'timestamp',
              KeyType: 'RANGE'
          }
      ],
      AttributeDefinitions: [ 
          {
              AttributeName: 'username',
              AttributeType: 'S'
          },
          {
              AttributeName: 'timestamp',
              AttributeType: 'S'
          }
      ],
      ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
      }
    };

    // テーブル作成
    const command = new CreateTableCommand(params);
    dynamoDB.send(command)
      .then((data) => console.log(data))
      .catch((error) => console.error(error));


    const fetchComments = async () => {
      if (youtubeKey && liveId) {
        // YouTubeコメントを取得する処理
        try {
          const liveChatId = await getLiveChatId(liveId)
          console.log(liveChatId)
          const randomCommentText = await retrieveLiveComments(liveChatId);

          if (randomCommentText == '') {
            return;
          }

          // handleSendChatを呼び出し、ランダムなコメントを送信
          handleSendChat(randomCommentText);
        } catch (error) {
          console.error("Error fetching comments:", error);
        }
      } else {
        const latestMessage = await getLatestMessageForPartitionKey(otherName);
        if (latestMessage == '') {
          return;
        }
        handleSendChat(latestMessage);
      };
    };

    const intervalId = setInterval(fetchComments, INTERVAL_MILL_SECONDS_RETRIEVING_COMMENTS);

    // クリーンアップ関数
    return () => clearInterval(intervalId);
  }, [dynamoTableName, getLatestMessageForPartitionKey, getLiveChatId, handleSendChat, liveId, otherName, retrieveLiveComments, youtubeKey]);

  return (
    <div className={`${m_plus_2.variable} ${montserrat.variable}`}>
      <Meta />
      <Introduction openAiKey={openAiKey} onChangeAiKey={setOpenAiKey} />
      <VrmViewer />
      <MessageInputContainer
        isChatProcessing={chatProcessing}
        onChatProcessStart={handleSendChat}
      />
      <Menu
        openAiKey={openAiKey}
        youtubeKey={youtubeKey}
        liveId={liveId}
        dynamoTableName={dynamoTableName}
        myName={myName}
        otherName={otherName}
        systemPrompt={systemPrompt}
        chatLog={chatLog}
        koeiroParam={koeiroParam}
        assistantMessage={assistantMessage}
        onChangeAiKey={setOpenAiKey}
        onChangeYoutubeKey={setYoutubeKey}
        onChangeLiveId={setLiveId}
        onChangeDynamoTableName={setDynamoTableName}
        onChangeMyName={setMyName}
        onChangeOtherName={setOtherName}
        onChangeSystemPrompt={setSystemPrompt}
        onChangeChatLog={handleChangeChatLog}
        onChangeKoeiromapParam={setKoeiroParam}
      />
      <GitHubLink />
    </div>
  );
}
