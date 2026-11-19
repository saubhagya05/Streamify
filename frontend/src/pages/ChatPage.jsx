import { useEffect, useState } from "react";
import { useParams } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken } from "../lib/api";
import { useThemeStore } from "../store/useThemeStore";

import {
  Channel,
  Chat,
  MessageInput,
  MessageList,
  Thread,
  Window,
  useChannelStateContext,
  useChatContext,
} from "stream-chat-react";
import { StreamChat } from "stream-chat";
import toast from "react-hot-toast";

import "stream-chat-react/dist/css/v2/index.css";

import ChatLoader from "../components/ChatLoader";
import { VideoIcon } from "lucide-react";
import Avatar from "../components/Avatar";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

const DARK_THEMES = new Set([
  "dark", "night", "dracula", "business", "halloween",
  "forest", "coffee", "luxury", "black", "synthwave", "dim", "sunset",
]);

const ChatPage = () => {
  const { id: targetUserId } = useParams();
  const [chatClient, setChatClient] = useState(null);
  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(true);

  const { authUser } = useAuthUser();
  const { theme } = useThemeStore();

  const { data: tokenData } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!authUser,
  });

  useEffect(() => {
    const initChat = async () => {
      if (!tokenData?.token || !authUser) return;

      try {
        const client = StreamChat.getInstance(STREAM_API_KEY);

        // If connected as a different user, disconnect first; skip if already this user
        if (client.userID !== authUser._id) {
          if (client.userID) await client.disconnectUser();
          await client.connectUser(
            {
              id: authUser._id,
              name: authUser.fullName,
              // base64 images exceed Stream's 100KB payload limit — send empty string instead
              image: authUser.profilePic?.startsWith("data:") ? "" : (authUser.profilePic || ""),
            },
            tokenData.token
          );
        }

        const channelId = [authUser._id, targetUserId].sort().join("-");
        const currChannel = client.channel("messaging", channelId, {
          members: [authUser._id, targetUserId],
        });
        await currChannel.watch();

        setChatClient(client);
        setChannel(currChannel);
      } catch (error) {
        console.error("Error initializing chat:", error);
        toast.error("Could not connect to chat. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    initChat();
  }, [tokenData, authUser, targetUserId]);

  const handleVideoCall = () => {
    if (!channel) return;
    const callUrl = `${window.location.origin}/call/${channel.id}`;
    channel.sendMessage({ text: `I've started a video call. Join me: ${callUrl}` });
    toast.success("Video call link sent!");
  };

  if (loading || !chatClient || !channel) return <ChatLoader />;

  const streamTheme = DARK_THEMES.has(theme) ? "str-chat__theme-dark" : "str-chat__theme-light";

  return (
    <div className="h-[calc(100vh-4rem)]">
      <Chat client={chatClient} theme={streamTheme}>
        <Channel channel={channel}>
          <Window>
            <CustomChannelHeader onVideoCall={handleVideoCall} />
            <MessageList />
            <MessageInput focus />
          </Window>
          <Thread />
        </Channel>
      </Chat>
    </div>
  );
};

const CustomChannelHeader = ({ onVideoCall }) => {
  const { channel } = useChannelStateContext();
  const { client } = useChatContext();

  const members = Object.values(channel.state.members || {});
  const other = members.find((m) => m.user?.id !== client.userID);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-base-300 bg-base-100 z-10">
      <div className="flex items-center gap-3">
        {other?.user && (
          <Avatar
            src={other.user.image}
            name={other.user.name}
            className="size-10 text-sm"
          />
        )}
        <div>
          <h2 className="font-semibold text-base leading-tight">
            {other?.user?.name || "Chat"}
          </h2>
          <p className="text-xs text-base-content/50">Language Exchange Partner</p>
        </div>
      </div>

      <button onClick={onVideoCall} className="btn btn-success btn-sm gap-2">
        <VideoIcon className="size-4" />
        <span className="hidden sm:inline">Video Call</span>
      </button>
    </div>
  );
};

export default ChatPage;
