import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useGetMarketplaceStats,
  useListCategories,
  useListJobs as useGenListJobs,
  useCreateJob as useGenCreateJob,
  useListFreelancers as useGenListFreelancers,
  useCreateProposal as useGenCreateProposal,
  useListConversations as useGenListConversations,
  useListNotifications as useGenListNotifications,
  getJob,
  getFreelancer,
  listProposals,
  listMessages,
  sendMessage,
  type MarketplaceStats,
  type Category,
  type JobCard,
  type JobDetail,
  type CreateJobBody,
  type FreelancerCard,
  type FreelancerDetail,
  type Proposal,
  type ProposalDetail,
  type CreateProposalBody,
  type ConversationSummary,
  type Message,
  type Notification,
  type ListJobsParams,
  type ListFreelancersParams,
} from "@workspace/api-client-react";

import { api } from "./api";

export type {
  MarketplaceStats as Stats,
  Category,
  JobCard,
  JobDetail,
  CreateJobBody,
  FreelancerCard,
  FreelancerDetail,
  Proposal,
  ProposalDetail,
  CreateProposalBody,
  ConversationSummary,
  Message,
  Notification,
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

// ===== Stats / categories =====
export function useStats() {
  return useGetMarketplaceStats();
}

export function useCategories() {
  return useListCategories();
}

// ===== Jobs =====
export function useJobs(filters: ListJobsParams = {}) {
  return useGenListJobs(filters);
}

export function useJob(id: number | string | undefined) {
  const numId = typeof id === "string" ? Number(id) : id;
  return useQuery({
    queryKey: ["/api/jobs", numId],
    queryFn: () => getJob(numId!),
    enabled: numId !== undefined && Number.isFinite(numId) && numId > 0,
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useGenCreateJob({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/jobs"] }),
    },
  });
}

// ===== Freelancers =====
export function useFreelancers(filters: ListFreelancersParams = {}) {
  return useGenListFreelancers(filters);
}

export function useFreelancer(id: number | string | undefined) {
  const numId = typeof id === "string" ? Number(id) : id;
  return useQuery({
    queryKey: ["/api/freelancers", numId],
    queryFn: () => getFreelancer(numId!),
    enabled: numId !== undefined && Number.isFinite(numId) && numId > 0,
  });
}

// ===== Proposals =====
export function useMyProposals() {
  return useQuery({
    queryKey: ["/api/proposals", { mine: true }],
    queryFn: () => listProposals({ mine: true }),
  });
}

export function useJobProposals(jobId: number | string | undefined) {
  const numId = typeof jobId === "string" ? Number(jobId) : jobId;
  return useQuery({
    queryKey: ["/api/proposals", { jobId: numId }],
    queryFn: () => listProposals({ jobId: numId }),
    enabled: numId !== undefined && Number.isFinite(numId) && numId > 0,
  });
}

export function useCreateProposal() {
  const qc = useQueryClient();
  return useGenCreateProposal({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/proposals"] }),
    },
  });
}

// ===== Conversations / Messages =====
export function useConversations() {
  return useGenListConversations();
}

export function useMessages(conversationId: number | string | undefined) {
  const numId = typeof conversationId === "string" ? Number(conversationId) : conversationId;
  return useQuery({
    queryKey: ["/api/conversations", numId, "messages"],
    queryFn: () => listMessages(numId!),
    enabled: numId !== undefined && Number.isFinite(numId) && numId > 0,
    refetchInterval: 5000,
  });
}

export function useSendMessage(conversationId: number | string) {
  const qc = useQueryClient();
  const numId = typeof conversationId === "string" ? Number(conversationId) : conversationId;
  return useMutation({
    mutationFn: (body: string) =>
      sendMessage(numId!, { body }),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: ["/api/conversations", numId, "messages"],
      }),
  });
}

// ===== Notifications =====
export function useNotifications() {
  return useGenListNotifications();
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api("/notifications/read-all", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });
}

// ===== Payments =====
export function usePayments() {
  return useQuery<Payment[]>({
    queryKey: ["payments"],
    queryFn: () => api<Payment[]>("/payments"),
  });
}
