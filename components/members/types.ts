/** One row of the admin member list (U-2). Read with the service role, admin only. */
export interface MemberRow {
  id: string;
  email: string;
  displayName: string;
  className: string | null;
  role: 'member' | 'admin';
  active: boolean;
  mustChangePassword: boolean;
  /** ISO timestamp; shown in WIB on the server. */
  createdAt: string;
}
