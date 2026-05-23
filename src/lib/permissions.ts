import type { Member } from "@/types/devwiki";

export function canEditContent(member?: Pick<Member, "role"> | null) {
  return member?.role === "owner" || member?.role === "editor";
}

export function canManageMembers(member?: Pick<Member, "role"> | null) {
  return member?.role === "owner";
}

export function roleLabel(role: Member["role"]) {
  return role === "owner"
    ? "owner"
    : role === "editor"
      ? "editor"
      : "viewer";
}
