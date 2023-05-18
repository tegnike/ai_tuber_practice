import { IconButton } from "./iconButton";
import { Message } from "@/features/messages/messages";
import { KoeiroParam } from "@/features/constants/koeiroParam";
import { ChatLog } from "./chatLog";
import React, { useCallback, useContext, useRef, useState } from "react";
import { Settings } from "./settings";
import { ViewerContext } from "@/features/vrmViewer/viewerContext";
// import { AssistantText } from "./assistantText";

type Props = {
  openAiKey: string;
  youtubeKey: string;
  liveId: string;
  dynamoTableName: string;
  myName: string;
  otherName: string;
  systemPrompt: string;
  chatLog: Message[];
  koeiroParam: KoeiroParam;
  assistantMessage: string;
  onChangeSystemPrompt: (systemPrompt: string) => void;
  onChangeAiKey: (key: string) => void;
  onChangeYoutubeKey: (key: string) => void;
  onChangeLiveId: (key: string) => void;
  onChangeDynamoTableName: (key: string) => void;
  onChangeMyName: (key: string) => void;
  onChangeOtherName: (key: string) => void;
  onChangeChatLog: (index: number, text: string) => void;
  onChangeKoeiromapParam: (param: KoeiroParam) => void;
};
export const Menu = ({
  openAiKey,
  youtubeKey,
  liveId,
  dynamoTableName,
  myName,
  otherName,
  systemPrompt,
  chatLog,
  koeiroParam,
  assistantMessage,
  onChangeSystemPrompt,
  onChangeAiKey,
  onChangeYoutubeKey,
  onChangeLiveId,
  onChangeDynamoTableName,
  onChangeMyName,
  onChangeOtherName,
  onChangeChatLog,
  onChangeKoeiromapParam,
}: Props) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showChatLog, setShowChatLog] = useState(false);
  const { viewer } = useContext(ViewerContext);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChangeSystemPrompt = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChangeSystemPrompt(event.target.value);
    },
    [onChangeSystemPrompt]
  );

  const handleAiKeyChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChangeAiKey(event.target.value);
    },
    [onChangeAiKey]
  );

  const handleYoutubeKeyChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChangeYoutubeKey(event.target.value);
    },
    [onChangeYoutubeKey]
  );

  const handleLiveIdChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChangeLiveId(event.target.value);
    },
    [onChangeLiveId]
  );

  const handleDynamoTableNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChangeDynamoTableName(event.target.value);
    },
    [onChangeDynamoTableName]
  );

  const handleMyNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChangeMyName(event.target.value);
    },
    [onChangeMyName]
  );

  const handleOtherNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChangeOtherName(event.target.value);
    },
    [onChangeOtherName]
  );

  const handleChangeKoeiroParam = useCallback(
    (x: number, y: number) => {
      onChangeKoeiromapParam({
        speakerX: x,
        speakerY: y,
      });
    },
    [onChangeKoeiromapParam]
  );

  const handleClickOpenVrmFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleChangeVrmFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files) return;

      const file = files[0];
      if (!file) return;

      const file_type = file.name.split(".").pop();

      if (file_type === "vrm") {
        const blob = new Blob([file], { type: "application/octet-stream" });
        const url = window.URL.createObjectURL(blob);
        viewer.loadVrm(url);
      }

      event.target.value = "";
    },
    [viewer]
  );

  return (
    <>
      <div className="absolute z-10 m-24">
        <div className="grid grid-flow-col gap-[8px]">
          <IconButton
            iconName="24/Menu"
            label="設定"
            isProcessing={false}
            onClick={() => setShowSettings(true)}
          ></IconButton>
          {showChatLog ? (
            <IconButton
              iconName="24/CommentOutline"
              label="会話ログ"
              isProcessing={false}
              onClick={() => setShowChatLog(false)}
            />
          ) : (
            <IconButton
              iconName="24/CommentFill"
              label="会話ログ"
              isProcessing={false}
              disabled={chatLog.length <= 0}
              onClick={() => setShowChatLog(true)}
            />
          )}
        </div>
      </div>
      {showChatLog && <ChatLog messages={chatLog} />}
      {showSettings && (
        <Settings
          openAiKey={openAiKey}
          youtubeKey={youtubeKey}
          liveId={liveId}
          dynamoTableName={dynamoTableName}
          myName={myName}
          otherName={otherName}
          chatLog={chatLog}
          systemPrompt={systemPrompt}
          koeiroParam={koeiroParam}
          onClickClose={() => setShowSettings(false)}
          onChangeAiKey={handleAiKeyChange}
          onChangeYoutubeKey={handleYoutubeKeyChange}
          onChangeLiveId={handleLiveIdChange}
          onChangeDynamoTableName={handleDynamoTableNameChange}
          onChangeMyName={handleMyNameChange}
          onChangeOtherName={handleOtherNameChange}
          onChangeSystemPrompt={handleChangeSystemPrompt}
          onChangeChatLog={onChangeChatLog}
          onChangeKoeiroParam={handleChangeKoeiroParam}
          onClickOpenVrmFile={handleClickOpenVrmFile}
        />
      )}
      {/* {!showChatLog && assistantMessage && (
        <AssistantText message={assistantMessage} />
      )} */}
      <input
        type="file"
        className="hidden"
        accept=".vrm"
        ref={fileInputRef}
        onChange={handleChangeVrmFile}
      />
    </>
  );
};
