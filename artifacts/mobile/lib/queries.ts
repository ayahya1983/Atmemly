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
  useListSavedJobs as useGenListSavedJobs,
  useSaveJob as useGenSaveJob,
  useUnsaveJob as useGenUnsaveJob,
  useUpdateFreelancerProfile as useGenUpdateFreelancerProfile,
  useUpdateClientProfile as useGenUpdateClientProfile,
  useUpdateProposalStatus as useGenUpdateProposalStatus,
  useCreatePaymentIntent as useGenCreatePaymentIntent,
  useCompleteJob as useGenCompleteJob,
  useCreateReview as useGenCreateReview,
  getJob,
  getFreelancer,
  getClient,
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
  type ClientDetail,
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
  ClientDetail,
  Proposal,
  ProposalDetail,
  CreateProposalBody,
  ConversationSummary,
  Message,
  Notification,
  ListJobsParams,
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

export function useClient(id: number | string | undefined) {
  const numId = typeof id === "string" ? Number(id) : id;
  return useQuery({
    queryKey: ["/api/clients", numId],
    queryFn: () => getClient(numId!),
    enabled: numId !== undefined && Number.isFinite(numId) && numId > 0,
  });
}

export function useUpdateFreelancerProfile() {
  const qc = useQueryClient();
  return useGenUpdateFreelancerProfile({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/freelancers"] });
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      },
    },
  });
}

export function useUpdateClientProfile() {
  const qc = useQueryClient();
  return useGenUpdateClientProfile({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/clients"] });
        qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      },
    },
  });
}

// ===== Proposals =====
export function useMyProposals() {
  return useQuery({
    queryKey: ["/api/proposals", { mine: true }],
    queryFn: () => listProposals({ mine: true }),
  });
}

export function useJobProposals(
  jobId: number | string | undefined,
  options?: { enabled?: boolean },
) {
  const numId = typeof jobId === "string" ? Number(jobId) : jobId;
  const idOk = numId !== undefined && Number.isFinite(numId) && numId > 0;
  const callerEnabled = options?.enabled ?? true;
  return useQuery({
    queryKey: ["/api/proposals", { jobId: numId }],
    queryFn: () => listProposals({ jobId: numId }),
    enabled: idOk && callerEnabled,
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

export function useUpdateProposalStatus() {
  const qc = useQueryClient();
  return useGenUpdateProposalStatus({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/proposals"] }),
    },
  });
}

export function useCreatePaymentIntent() {
  const qc = useQueryClient();
  return useGenCreatePaymentIntent({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["payments"] });
        qc.invalidateQueries({ queryKey: ["/api/jobs"] });
      },
    },
  });
}

export function useCompleteJob() {
  const qc = useQueryClient();
  return useGenCompleteJob({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/jobs"] });
        qc.invalidateQueries({ queryKey: ["/api/proposals"] });
      },
    },
  });
}

export function useCreateReview() {
  const qc = useQueryClient();
  return useGenCreateReview({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/reviews"] }),
    },
  });
}

// ===== Saved jobs =====
export function useSavedJobs() {
  return useGenListSavedJobs();
}

export function useSaveJob() {
  const qc = useQueryClient();
  return useGenSaveJob({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/jobs"] });
        qc.invalidateQueries({ queryKey: ["/api/saved-jobs"] });
      },
    },
  });
}

export function useUnsaveJob() {
  const qc = useQueryClient();
  return useGenUnsaveJob({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/jobs"] });
        qc.invalidateQueries({ queryKey: ["/api/saved-jobs"] });
      },
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
