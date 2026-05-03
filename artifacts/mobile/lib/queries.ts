import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./api";

export type JobCard = {
  id: number;
  title: string;
  description?: string;
  budgetType?: "fixed" | "hourly";
  budget?: number | string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  category?: string | null;
  skills?: string[] | null;
  status?: string;
  proposalsCount?: number;
  createdAt?: string;
  client?: { id: number; name?: string; fullName?: string } | null;
};

export type JobDetail = JobCard & {
  fullDescription?: string;
};

export type FreelancerCard = {
  id: number;
  fullName?: string;
  name?: string;
  title?: string | null;
  hourlyRate?: number | string | null;
  rating?: number | null;
  reviewsCount?: number;
  skills?: string[] | null;
  avatarUrl?: string | null;
  country?: string | null;
};

export type FreelancerDetail = FreelancerCard & {
  bio?: string | null;
  portfolio?: { id: number; title: string; url?: string }[];
};

export type ConversationSummary = {
  id: number;
  otherUser?: { id: number; fullName?: string; name?: string; avatarUrl?: string | null };
  lastMessage?: { body: string; createdAt: string } | null;
  unreadCount?: number;
};

export type Message = {
  id: number;
  conversationId: number;
  senderId: number;
  body: string;
  createdAt: string;
};

export type Notification = {
  id: number;
  title?: string;
  body?: string;
  message?: string;
  type?: string;
  read?: boolean;
  createdAt: string;
};

export type Payment = {
  id: number;
  amount: number | string;
  currency?: string;
  status: string;
  createdAt: string;
  jobId?: number | null;
  jobTitle?: string | null;
};

export type Proposal = {
  id: number;
  jobId: number;
  jobTitle?: string;
  bidAmount: number | string;
  coverLetter?: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
};

export type Category = { id: number; slug: string; nameEn: string; nameAr?: string; jobsCount?: number };
export type Stats = {
  jobsPosted?: number;
  freelancersCount?: number;
  clientsCount?: number;
  totalEarnings?: number;
};

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  if (entries.length === 0) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of entries) sp.append(k, String(v));
  return `?${sp.toString()}`;
}

// ===== Stats / categories =====
export function useStats() {
  return useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: () => api<Stats>("/meta/stats"),
  });
}

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () => api<Category[]>("/meta/categories"),
  });
}

// ===== Jobs =====
export function useJobs(filters: {
  q?: string;
  category?: string;
  mine?: boolean;
} = {}) {
  return useQuery<JobCard[]>({
    queryKey: ["jobs", filters],
    queryFn: () => api<JobCard[]>(`/jobs${qs(filters)}`),
  });
}

export function useJob(id: number | string | undefined) {
  return useQuery<JobDetail>({
    queryKey: ["job", id],
    queryFn: () => api<JobDetail>(`/jobs/${id}`),
    enabled: id !== undefined && id !== "",
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      description: string;
      budgetType: "fixed" | "hourly";
      budget?: number;
      category?: string;
    }) => api("/jobs", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

// ===== Freelancers =====
export function useFreelancers(filters: { q?: string; skill?: string } = {}) {
  return useQuery<FreelancerCard[]>({
    queryKey: ["freelancers", filters],
    queryFn: () => api<FreelancerCard[]>(`/freelancers${qs(filters)}`),
  });
}

export function useFreelancer(id: number | string | undefined) {
  return useQuery<FreelancerDetail>({
    queryKey: ["freelancer", id],
    queryFn: () => api<FreelancerDetail>(`/freelancers/${id}`),
    enabled: id !== undefined && id !== "",
  });
}

// ===== Proposals =====
export function useMyProposals() {
  return useQuery<Proposal[]>({
    queryKey: ["proposals", "mine"],
    queryFn: () => api<Proposal[]>("/proposals?mine=true"),
  });
}

export function useJobProposals(jobId: number | string | undefined) {
  return useQuery<Proposal[]>({
    queryKey: ["proposals", "job", jobId],
    queryFn: () => api<Proposal[]>(`/proposals?jobId=${jobId}`),
    enabled: jobId !== undefined && jobId !== "",
  });
}

export function useCreateProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      jobId: number;
      bidAmount: number;
      coverLetter: string;
    }) => api("/proposals", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["proposals"] }),
  });
}

// ===== Conversations / Messages =====
export function useConversations() {
  return useQuery<ConversationSummary[]>({
    queryKey: ["conversations"],
    queryFn: () => api<ConversationSummary[]>("/conversations"),
  });
}

export function useMessages(conversationId: number | string | undefined) {
  return useQuery<Message[]>({
    queryKey: ["messages", conversationId],
    queryFn: () => api<Message[]>(`/conversations/${conversationId}/messages`),
    enabled: conversationId !== undefined && conversationId !== "",
    refetchInterval: 5000,
  });
}

export function useSendMessage(conversationId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      api<Message>(`/conversations/${conversationId}/messages`, {
        method: "POST",
        body: { body },
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["messages", conversationId] }),
  });
}

// ===== Notifications =====
export function useNotifications() {
  return useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => api<Notification[]>("/notifications"),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api("/notifications/read-all", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

// ===== Payments =====
export function usePayments() {
  return useQuery<Payment[]>({
    queryKey: ["payments"],
    queryFn: () => api<Payment[]>("/payments"),
  });
}
