import { useState } from "react";
import { useListConversations, useListMessages, useSendMessage, getListMessagesQueryKey, getListConversationsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, UserCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

export default function ClientMessages() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();

  const { data: conversations, isLoading: isConvLoading } = useListConversations({
    query: { refetchInterval: 4000, queryKey: getListConversationsQueryKey() }
  });

  const { data: messages, isLoading: isMsgLoading } = useListMessages(activeId!, {
    query: { enabled: !!activeId, refetchInterval: 4000, queryKey: getListMessagesQueryKey(activeId!) }
  });

  const sendMutation = useSendMessage();

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !activeId) return;

    sendMutation.mutate(
      { id: activeId, data: { body: message } },
      {
        onSuccess: () => {
          setMessage("");
          queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(activeId) });
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        }
      }
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
      <Card className="md:col-span-1 h-full overflow-hidden flex flex-col">
        <div className="p-4 border-b font-bold">Conversations</div>
        <ScrollArea className="flex-1">
          {conversations?.map((c) => (
            <div
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${activeId === c.id ? "bg-muted" : ""}`}
            >
              <div className="flex items-center gap-3">
                {c.otherUserAvatarUrl ? (
                  <img src={c.otherUserAvatarUrl} className="w-10 h-10 rounded-full" />
                ) : (
                  <UserCircle className="w-10 h-10 text-muted-foreground" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{c.otherUserName}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.jobTitle}</div>
                </div>
                {c.unreadCount > 0 && (
                  <div className="w-5 h-5 bg-primary text-primary-foreground rounded-full text-xs flex items-center justify-center">
                    {c.unreadCount}
                  </div>
                )}
              </div>
            </div>
          ))}
          {conversations?.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">No conversations yet</div>
          )}
        </ScrollArea>
      </Card>

      <Card className="md:col-span-2 h-full flex flex-col overflow-hidden">
        {activeId ? (
          <>
            <div className="p-4 border-b font-bold">Chat</div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 flex flex-col justify-end min-h-full">
                {messages?.map((m) => (
                  <div key={m.id} className={`flex flex-col max-w-[70%] ${m.senderId === conversations?.find(c => c.id === activeId)?.otherUserId ? "self-start" : "self-end items-end"}`}>
                    <div className={`p-3 rounded-lg ${m.senderId === conversations?.find(c => c.id === activeId)?.otherUserId ? "bg-muted" : "bg-primary text-primary-foreground"}`}>
                      {m.body}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="p-4 border-t">
              <form onSubmit={handleSend} className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                />
                <Button type="submit" disabled={sendMutation.isPending || !message.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a conversation to start messaging
          </div>
        )}
      </Card>
    </div>
  );
}
