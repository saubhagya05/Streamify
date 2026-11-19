import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import {
  getOutgoingFriendReqs,
  getRecommendedUsers,
  sendFriendRequest,
  getFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
} from "../lib/api";
import {
  BookOpenIcon,
  CheckCircleIcon,
  GlobeIcon,
  MapPinIcon,
  UserCheckIcon,
  UserPlusIcon,
  UserXIcon,
  XIcon,
} from "lucide-react";
import { capitialize } from "../lib/utils";
import { getLanguageFlag } from "../components/FriendCard";
import Avatar from "../components/Avatar";

const DiscoverPage = () => {
  const queryClient = useQueryClient();
  const [outgoingRequestsIds, setOutgoingRequestsIds] = useState(new Set());
  const [selectedUser, setSelectedUser] = useState(null);
  const [sendPendingIds, setSendPendingIds] = useState(new Set());
  const [actionPendingIds, setActionPendingIds] = useState(new Set());

  const { data: recommendedUsers = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: getRecommendedUsers,
  });

  const { data: outgoingFriendReqs } = useQuery({
    queryKey: ["outgoingFriendReqs"],
    queryFn: getOutgoingFriendReqs,
  });

  const { data: friendRequests } = useQuery({
    queryKey: ["friendRequests"],
    queryFn: getFriendRequests,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });

  useEffect(() => {
    const ids = new Set();
    outgoingFriendReqs?.forEach((req) => {
      if (req.recipient?._id) ids.add(req.recipient._id);
    });
    setOutgoingRequestsIds(ids);
  }, [outgoingFriendReqs]);

  // userId → requestId for people who sent ME a request
  const incomingMap = useMemo(() => {
    const map = new Map();
    friendRequests?.incomingReqs?.forEach((req) => {
      if (req.sender?._id) map.set(req.sender._id, req._id);
    });
    return map;
  }, [friendRequests]);

  const { mutate: sendRequest } = useMutation({
    mutationFn: sendFriendRequest,
    onMutate: (userId) => setSendPendingIds((p) => new Set([...p, userId])),
    onSettled: (_, __, userId) =>
      setSendPendingIds((p) => { const n = new Set(p); n.delete(userId); return n; }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["outgoingFriendReqs"] }),
  });

  const { mutate: acceptRequest } = useMutation({
    mutationFn: acceptFriendRequest,
    onMutate: (reqId) => setActionPendingIds((p) => new Set([...p, reqId])),
    onSettled: (_, __, reqId) =>
      setActionPendingIds((p) => { const n = new Set(p); n.delete(reqId); return n; }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const { mutate: rejectRequest } = useMutation({
    mutationFn: rejectFriendRequest,
    onMutate: (reqId) => setActionPendingIds((p) => new Set([...p, reqId])),
    onSettled: (_, __, reqId) =>
      setActionPendingIds((p) => { const n = new Set(p); n.delete(reqId); return n; }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["friendRequests"] }),
  });

  const makeProps = (user) => {
    const incomingRequestId = incomingMap.get(user._id);
    return {
      hasIncoming: Boolean(incomingRequestId),
      incomingRequestId,
      hasOutgoing: outgoingRequestsIds.has(user._id),
      isSendPending: sendPendingIds.has(user._id),
      isActionPending: actionPendingIds.has(incomingRequestId),
    };
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto space-y-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Discover Learners</h2>
          <p className="text-base-content/60 mt-1">
            Find language exchange partners — click a card to learn more
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : recommendedUsers.length === 0 ? (
          <div className="card bg-base-200 p-8 text-center">
            <h3 className="font-semibold text-lg mb-2">No recommendations available</h3>
            <p className="text-base-content/60">Check back later for new language partners!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {recommendedUsers.map((user) => (
              <UserCard
                key={user._id}
                user={user}
                {...makeProps(user)}
                onSendRequest={sendRequest}
                onAccept={acceptRequest}
                onReject={rejectRequest}
                onViewProfile={() => setSelectedUser(user)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedUser && (
        <UserModal
          user={selectedUser}
          {...makeProps(selectedUser)}
          onSendRequest={sendRequest}
          onAccept={acceptRequest}
          onReject={rejectRequest}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
};

/* ─── Shared action buttons ─────────────────────────────────────────────────── */
const ActionButtons = ({
  hasIncoming, incomingRequestId, hasOutgoing,
  isSendPending, isActionPending, userId,
  onSendRequest, onAccept, onReject, size = "sm",
}) => {
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };

  if (hasIncoming) {
    return (
      <div className="flex gap-2 w-full mt-2">
        <button
          className={`btn btn-success btn-${size} flex-1`}
          onClick={stop(() => onAccept(incomingRequestId))}
          disabled={isActionPending}
        >
          <UserCheckIcon className="size-3.5" />
          Accept
        </button>
        <button
          className={`btn btn-error btn-${size} flex-1`}
          onClick={stop(() => onReject(incomingRequestId))}
          disabled={isActionPending}
        >
          <UserXIcon className="size-3.5" />
          Reject
        </button>
      </div>
    );
  }

  if (hasOutgoing) {
    return (
      <button className={`btn btn-${size} btn-disabled w-full mt-2`} disabled>
        <CheckCircleIcon className="size-3.5" />
        Request Sent
      </button>
    );
  }

  return (
    <button
      className={`btn btn-primary btn-${size} w-full mt-2`}
      onClick={stop(() => onSendRequest(userId))}
      disabled={isSendPending}
    >
      <UserPlusIcon className="size-3.5" />
      {isSendPending ? "Sending…" : "Add Friend"}
    </button>
  );
};

/* ─── Card ──────────────────────────────────────────────────────────────────── */
const UserCard = ({ user, onViewProfile, ...actionProps }) => (
  <div
    className="card bg-base-200 border border-base-300 hover:border-primary/40 hover:shadow-xl
                transition-all duration-300 cursor-pointer group overflow-hidden"
    onClick={onViewProfile}
  >
    <div className="h-16 bg-gradient-to-br from-primary/40 via-secondary/25 to-accent/20" />
    <div className="flex justify-center -mt-9 mb-2">
      <Avatar
        src={user.profilePic}
        name={user.fullName}
        className="size-16 text-xl ring-4 ring-base-200 shadow-md group-hover:ring-primary/30 transition-all"
      />
    </div>
    <div className="px-4 pb-4 flex flex-col items-center gap-2 text-center">
      <h3 className="font-bold text-base leading-tight">{user.fullName}</h3>
      {user.location && (
        <p className="text-xs text-base-content/55 flex items-center gap-1">
          <MapPinIcon className="size-3" />
          {user.location}
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-1.5 mt-1">
        <span className="badge badge-secondary badge-sm gap-1">
          {getLanguageFlag(user.nativeLanguage)}
          {capitialize(user.nativeLanguage)}
        </span>
        <span className="badge badge-outline badge-sm gap-1">
          {getLanguageFlag(user.learningLanguage)}
          {capitialize(user.learningLanguage)}
        </span>
      </div>
      {user.bio && (
        <p className="text-xs text-base-content/55 line-clamp-2 mt-1">{user.bio}</p>
      )}
      <ActionButtons userId={user._id} {...actionProps} size="sm" />
    </div>
  </div>
);

/* ─── Modal ─────────────────────────────────────────────────────────────────── */
const UserModal = ({ user, onClose, ...actionProps }) => (
  <div className="modal modal-open modal-bottom sm:modal-middle" onClick={onClose}>
    <div className="modal-box max-w-sm p-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <div className="relative h-28 bg-gradient-to-br from-primary/50 via-secondary/30 to-accent/25">
        <button
          className="btn btn-sm btn-circle btn-ghost absolute top-3 right-3 bg-base-100/40 hover:bg-base-100/70"
          onClick={onClose}
        >
          <XIcon className="size-4" />
        </button>
      </div>
      <div className="flex justify-center -mt-12 mb-3 px-6">
        <Avatar
          src={user.profilePic}
          name={user.fullName}
          className="size-24 text-3xl ring-4 ring-base-100 shadow-lg"
        />
      </div>
      <div className="px-6 pb-6 flex flex-col items-center gap-3 text-center">
        <div>
          <h2 className="text-xl font-bold">{user.fullName}</h2>
          {user.location && (
            <p className="text-sm text-base-content/55 flex items-center justify-center gap-1 mt-0.5">
              <MapPinIcon className="size-3.5" />
              {user.location}
            </p>
          )}
        </div>
        {user.bio && (
          <p className="text-sm text-base-content/70 leading-relaxed">{user.bio}</p>
        )}
        <div className="divider my-1" />
        <div className="w-full grid grid-cols-2 gap-3">
          <div className="bg-base-200 rounded-xl p-3 flex flex-col items-center gap-1.5">
            <GlobeIcon className="size-4 text-secondary" />
            <p className="text-xs text-base-content/55 font-medium uppercase tracking-wide">Native</p>
            <div className="flex items-center gap-1.5">
              {getLanguageFlag(user.nativeLanguage)}
              <span className="text-sm font-semibold">{capitialize(user.nativeLanguage)}</span>
            </div>
          </div>
          <div className="bg-base-200 rounded-xl p-3 flex flex-col items-center gap-1.5">
            <BookOpenIcon className="size-4 text-primary" />
            <p className="text-xs text-base-content/55 font-medium uppercase tracking-wide">Learning</p>
            <div className="flex items-center gap-1.5">
              {getLanguageFlag(user.learningLanguage)}
              <span className="text-sm font-semibold">{capitialize(user.learningLanguage)}</span>
            </div>
          </div>
        </div>
        <ActionButtons userId={user._id} {...actionProps} size="md" />
      </div>
    </div>
  </div>
);

export default DiscoverPage;
