// supabase/migrations/0001_init_schema.sql 기준으로 수기 작성한 타입.
// 실제 Supabase 프로젝트 연결 후에는 `supabase gen types typescript --linked`로
// 재생성해서 이 파일을 대체하는 것을 권장 (스키마 드리프트 방지).

export type Role = "owner" | "admin" | "team_lead" | "member";
export type ProjectStatus = "진행중" | "진행완료" | "진행예정";
export type TxKind = "수익" | "비용";
export type DeletionStatus = "pending" | "approved" | "rejected";
export type InvitationStatus = "pending" | "accepted" | "canceled" | "expired";
export type PlatformAdminRole = "super_admin" | "operator";

export interface RolePermissionSet {
  project_create: boolean;
  project_update: boolean;
  project_delete: boolean;
  transaction_create: boolean;
  transaction_update: boolean;
  transaction_delete: boolean;
  excel_upload: boolean;
  invite_member: boolean;
  company_settings: boolean;
}

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: { name: string };
        Update: Partial<{ name: string; deleted_at: string | null }>;
        Relationships: never[];
      };
      profiles: {
        Row: { id: string; display_name: string | null; email: string | null; created_at: string };
        Insert: { id: string; display_name?: string | null; email?: string | null };
        Update: Partial<{ display_name: string | null; email: string | null }>;
        Relationships: never[];
      };
      teams: {
        Row: { id: string; company_id: string; name: string; created_at: string };
        Insert: { company_id: string; name: string };
        Update: Partial<{ name: string }>;
        Relationships: never[];
      };
      memberships: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          role: Role;
          team_id: string | null;
          is_representative: boolean;
          status: "active" | "inactive";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          user_id: string;
          role: Role;
          team_id?: string | null;
          is_representative?: boolean;
          status?: "active" | "inactive";
        };
        Update: Partial<{
          role: Role;
          team_id: string | null;
          status: "active" | "inactive";
        }>;
        Relationships: never[];
      };
      invitations: {
        Row: {
          id: string;
          company_id: string;
          email: string;
          role: Exclude<Role, "owner">;
          team_id: string | null;
          invited_by: string;
          token: string;
          status: InvitationStatus;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          company_id: string;
          email: string;
          role: Exclude<Role, "owner">;
          team_id?: string | null;
          invited_by: string;
        };
        Update: Partial<{ status: InvitationStatus; expires_at: string }>;
        Relationships: never[];
      };
      role_permissions: {
        Row: {
          id: string;
          company_id: string;
          role: Exclude<Role, "owner">;
          permissions: RolePermissionSet;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          role: Exclude<Role, "owner">;
          permissions: RolePermissionSet;
        };
        Update: Partial<{ permissions: RolePermissionSet }>;
        Relationships: never[];
      };
      projects: {
        Row: {
          id: string;
          company_id: string;
          team_id: string | null;
          name: string;
          status: ProjectStatus;
          field: string | null;
          start_date: string | null;
          end_date: string | null;
          owner_name: string | null;
          note: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          team_id?: string | null;
          name: string;
          status?: ProjectStatus;
          field?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          owner_name?: string | null;
          note?: string | null;
          created_by: string;
        };
        Update: Partial<{
          team_id: string | null;
          name: string;
          status: ProjectStatus;
          field: string | null;
          start_date: string | null;
          end_date: string | null;
          owner_name: string | null;
          note: string | null;
        }>;
        Relationships: never[];
      };
      transactions: {
        Row: {
          id: string;
          company_id: string;
          project_id: string;
          tx_date: string;
          category: string;
          kind: TxKind;
          item_name: string | null;
          amount: number;
          currency: string;
          note: string | null;
          source: "manual" | "excel_upload";
          upload_batch_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          project_id: string;
          tx_date: string;
          category: string;
          kind: TxKind;
          item_name?: string | null;
          amount: number;
          currency?: string;
          note?: string | null;
          source?: "manual" | "excel_upload";
          upload_batch_id?: string | null;
          created_by: string;
        };
        Update: Partial<{
          tx_date: string;
          category: string;
          kind: TxKind;
          item_name: string | null;
          amount: number;
          currency: string;
          note: string | null;
        }>;
        Relationships: never[];
      };
      upload_batches: {
        Row: {
          id: string;
          company_id: string;
          uploaded_by: string;
          file_name: string;
          total_rows: number;
          saved_rows: number;
          excluded_rows: number;
          error_rows: number;
          created_at: string;
        };
        Insert: {
          company_id: string;
          uploaded_by: string;
          file_name: string;
          total_rows?: number;
          saved_rows?: number;
          excluded_rows?: number;
          error_rows?: number;
        };
        Update: Partial<{
          saved_rows: number;
          excluded_rows: number;
          error_rows: number;
        }>;
        Relationships: never[];
      };
      deletion_requests: {
        Row: {
          id: string;
          company_id: string;
          project_id: string | null;
          transaction_id: string | null;
          requested_by: string;
          reason: string;
          status: DeletionStatus;
          decided_by: string | null;
          decision_reason: string | null;
          created_at: string;
          decided_at: string | null;
        };
        Insert: {
          company_id: string;
          project_id?: string | null;
          transaction_id?: string | null;
          requested_by: string;
          reason: string;
        };
        Update: Partial<{
          status: DeletionStatus;
          decided_by: string;
          decision_reason: string | null;
          decided_at: string;
        }>;
        Relationships: never[];
      };
      platform_admins: {
        Row: {
          user_id: string;
          role: PlatformAdminRole;
          can_view_audit_log: boolean;
          created_at: string;
        };
        Insert: never; // 앱에서 생성 불가 (Supabase 콘솔 전용)
        Update: never;
        Relationships: never[];
      };
      platform_settings: {
        Row: {
          id: true;
          business_name: string | null;
          representative_name: string | null;
          business_registration_number: string | null;
          business_address: string | null;
          support_email: string | null;
          support_phone: string | null;
          dpo_name: string | null;
          dpo_contact: string | null;
          company_withdrawal_policy: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: never;
        Update: Partial<{
          business_name: string | null;
          representative_name: string | null;
          business_registration_number: string | null;
          business_address: string | null;
          support_email: string | null;
          support_phone: string | null;
          dpo_name: string | null;
          dpo_contact: string | null;
          company_withdrawal_policy: string | null;
          updated_by: string | null;
        }>;
        Relationships: never[];
      };
      platform_admin_access_log: {
        Row: {
          id: string;
          admin_user_id: string;
          company_id: string;
          resource: "members" | "projects" | "transactions";
          accessed_at: string;
        };
        Insert: never; // RPC 내부에서만 생성
        Update: never;
        Relationships: never[];
      };
      notices: {
        Row: {
          id: string;
          title: string;
          content: string;
          is_published: boolean;
          published_at: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          title: string;
          content: string;
          is_published?: boolean;
          created_by: string;
        };
        Update: Partial<{
          title: string;
          content: string;
          is_published: boolean;
        }>;
        Relationships: never[];
      };
      faqs: {
        Row: {
          id: string;
          question: string;
          answer: string;
          category: string | null;
          sort_order: number;
          is_published: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          question: string;
          answer: string;
          category?: string | null;
          sort_order?: number;
          is_published?: boolean;
          created_by: string;
        };
        Update: Partial<{
          question: string;
          answer: string;
          category: string | null;
          sort_order: number;
          is_published: boolean;
        }>;
        Relationships: never[];
      };
    };
    Functions: {
      create_company_with_owner: { Args: { company_name: string }; Returns: string };
      get_invitation_preview: {
        Args: { invitation_token: string };
        Returns: {
          email: string;
          company_name: string;
          role: Role;
          status: InvitationStatus;
          expires_at: string;
        }[];
      };
      accept_invitation: { Args: { invitation_token: string }; Returns: string };
      request_deletion: {
        Args: { p_project_id: string | null; p_transaction_id: string | null; p_reason: string };
        Returns: string;
      };
      decide_deletion_request: {
        Args: { p_request_id: string; p_approve: boolean; p_decision_reason: string | null };
        Returns: void;
      };
      admin_get_company_members: {
        Args: { p_company_id: string };
        Returns: {
          membership_id: string;
          user_id: string;
          display_name: string | null;
          email: string;
          role: Role;
          team_id: string | null;
          is_representative: boolean;
          status: string;
        }[];
      };
      admin_get_company_projects: { Args: { p_company_id: string }; Returns: Database["public"]["Tables"]["projects"]["Row"][] };
      admin_get_company_transactions: { Args: { p_company_id: string }; Returns: Database["public"]["Tables"]["transactions"]["Row"][] };
      admin_list_companies: {
        Args: Record<string, never>;
        Returns: {
          company_id: string;
          company_name: string;
          member_count: number;
          project_count: number;
          transaction_count: number;
          created_at: string;
        }[];
      };
    };
    Views: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
