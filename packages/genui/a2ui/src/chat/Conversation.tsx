import { useCallback, useState, useRef } from "@lynx-js/react";
import { A2UIRender } from "../core/A2UIRender";
import { type Resource } from "../core/types";
import { useLynxClient } from "./useLynxClient";
import {
  Input,
  KeyboardAwareResponder,
  KeyboardAwareRoot,
  KeyboardAwareTrigger,
} from '@lynx-js/lynx-ui-input'
import type { InputRef } from "@lynx-js/lynx-ui-input";

export interface Message {
  id: string;
  role: "user" | "agent";
  content: string;
  resource?: Resource;
}

export interface ConversationProps {
  initialInput?: string;
  messages?: Message[];
  sendMessage?: (content: string) => Promise<void>;
  url?: string;
}

export function Conversation(props: ConversationProps): any {
  const { initialInput, url } = props;

  // Logic to handle self-managed state if url is provided
  // We pass a dummy string if url is missing to satisfy the hook type, but we won't use the result if controlled
  const hookResult = useLynxClient(url || "");

  // If controlled props are provided, use them; otherwise use hook result if url is present
  const messages = props.messages ?? (url ? hookResult.messages : []);
  const sendMessage = props.sendMessage ?? (url ? hookResult.sendMessage : undefined);
  const inputRef = useRef<InputRef>(null);

  if (!sendMessage) {
    if (!props.messages) {
      // Fallback or error if neither controlled nor uncontrolled props are valid
      console.warn(
        "Conversation requires either `messages` and `sendMessage` OR `url`.",
      );
    }
  }

  console.log("Conversation render, messages count:", messages?.length);
  const [inputValue, setInputValue] = useState(initialInput);
  const [isLoading, setIsLoading] = useState(false);

  const handleInput = useCallback((e: any) => {
    console.log("handleInput", e);
    setInputValue(e);
  }, []);

  const handleSend = useCallback(async () => {
    console.log("handleSend", inputValue);
    setIsLoading(true);
    const content = inputValue || "Introduce yourself.";
    setInputValue("");
    inputRef.current?.blur();
    inputRef.current?.setValue("");
    try {
      if (sendMessage) {
        await sendMessage(content);
      }
    } catch (e) {
      console.error("sendMessage error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, sendMessage]);

  return (
    <KeyboardAwareRoot androidStatusBarPlusBottomBarHeight={74}>
      <KeyboardAwareResponder as='View' className='container luna-light' scrollOrientation="vertical">
        <scroll-view className="message-list" scroll-y>
          {messages &&
            messages.map((item: Message) =>
              item.role === "user" ? (
                <view key={`user-${item.id}`} className={`message-item user`}>
                  <text className="user-text">{item.content}</text>
                </view>
              ) : (
                <view
                  key={`assistant-${item.id}`}
                  className={`message-item assistant`}
                >
                  <A2UIRender
                    resource={item.resource!}
                    renderFallback={() => (
                      <text className="loading-text">Thinking...</text>
                    )}
                  />
                </view>
              ),
            )}
          {isLoading && (
            <view className={`message-item assistant`}>
              <text className="loading-text">Thinking...</text>
            </view>
          )}
        </scroll-view>
        <KeyboardAwareTrigger>
          <view id='panel' className='input-area'>
            <Input
              ref={inputRef}
              className='input'
              onInput={handleInput}
              // @ts-ignore
              defaultValue={inputValue || ""}
              placeholder='Ask me anything...'
            />
            <view className='send-btn' bindtap={handleSend}>
              <text className='send-text'>↑</text>
            </view>
          </view>
        </KeyboardAwareTrigger>
      </KeyboardAwareResponder>
    </KeyboardAwareRoot>
  );
}
