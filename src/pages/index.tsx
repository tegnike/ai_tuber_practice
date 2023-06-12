import { useCallback, useContext, useEffect, useState } from "react";
import VrmViewer from "@/components/vrmViewer";
import Live2DViewer from "@/components/live2DViewer";
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
  const [koeiroParam, setKoeiroParam] = useState<KoeiroParam>(DEFAULT_PARAM);
  const [chatProcessing, setChatProcessing] = useState(false);
  const [chatLog, setChatLog] = useState<Message[]>([]);
  const [assistantMessage, setAssistantMessage] = useState("");

  useEffect(() => {
    if (window.localStorage.getItem("chatVRMParams")) {
      const params = JSON.parse(
        window.localStorage.getItem("chatVRMParams") as string
      );
      setSystemPrompt(params.systemPrompt);
      setKoeiroParam(params.koeiroParam);
      setChatLog(params.chatLog);
    }
  }, []);

  useEffect(() => {
    process.nextTick(() =>
      window.localStorage.setItem(
        "chatVRMParams",
        JSON.stringify({ systemPrompt, koeiroParam, chatLog })
      )
    );
  }, [systemPrompt, koeiroParam, chatLog]);

  const handleChangeChatLog = useCallback(
    (targetIndex: number, text: string) => {
      const newChatLog = chatLog.map((v: Message, i) => {
        return i === targetIndex ? { role: v.role, content: text } : v;
      });

      setChatLog(newChatLog);
    },
    [chatLog]
  );

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

  /**
   * アシスタントとの会話を行う
   */
  const handleSendChat = useCallback(
    async (text: string) => {
      if (!openAiKey) {
        setAssistantMessage("APIキーが入力されていません");
        return;
      }

      const newMessage = text;

      if (newMessage == null) return;

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

      setChatLog(messageLogAssistant);
      setChatProcessing(false);
    },
    [systemPrompt, chatLog, handleSpeakAi, openAiKey, koeiroParam]
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

  // YouTubeコメントを取得する処理
  useEffect(() => {
    const fetchComments = async () => {
      if (youtubeKey && liveId) {
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
      };
    };

    const intervalId = setInterval(fetchComments, INTERVAL_MILL_SECONDS_RETRIEVING_COMMENTS);

    // クリーンアップ関数
    return () => clearInterval(intervalId);
  }, [getLiveChatId, handleSendChat, liveId, retrieveLiveComments, youtubeKey]);

  return (
    <div className={`${m_plus_2.variable} ${montserrat.variable}`}>
      <Meta />
      <Introduction openAiKey={openAiKey} onChangeAiKey={setOpenAiKey} />
      {/* <VrmViewer /> */}
      <Live2DViewer />
      <MessageInputContainer
        isChatProcessing={chatProcessing}
        onChatProcessStart={handleSendChat}
      />
      <Menu
        openAiKey={openAiKey}
        youtubeKey={youtubeKey}
        liveId={liveId}
        systemPrompt={systemPrompt}
        chatLog={chatLog}
        koeiroParam={koeiroParam}
        assistantMessage={assistantMessage}
        onChangeAiKey={setOpenAiKey}
        onChangeYoutubeKey={setYoutubeKey}
        onChangeLiveId={setLiveId}
        onChangeSystemPrompt={setSystemPrompt}
        onChangeChatLog={handleChangeChatLog}
        onChangeKoeiromapParam={setKoeiroParam}
        handleClickResetChatLog={() => setChatLog([])}
        handleClickResetSystemPrompt={() => setSystemPrompt(SYSTEM_PROMPT)}
      />
      <GitHubLink />
    </div>
  );
}
