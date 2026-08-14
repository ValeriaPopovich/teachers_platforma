import { reactive } from 'vue';

// UI-only state shared across the students Vue tree (and other modules that
// need to open a student/group form or profile, e.g. the dashboard). This
// replaces the old CustomEvent bridge with a plain reactive module import.

export const studentFormUi = reactive({ open: false, studentId: '' });
export function openNewStudent() {
  studentFormUi.studentId = '';
  studentFormUi.open = true;
}
export function openEditStudent(studentId) {
  studentFormUi.studentId = studentId;
  studentFormUi.open = true;
}
export function closeStudentForm() {
  studentFormUi.open = false;
}

export const groupFormUi = reactive({ open: false, groupId: '' });
export function openNewGroup() {
  groupFormUi.groupId = '';
  groupFormUi.open = true;
}
export function openEditGroup(groupId) {
  groupFormUi.groupId = groupId;
  groupFormUi.open = true;
}
export function closeGroupForm() {
  groupFormUi.open = false;
}

export const studentProfileUi = reactive({ open: false, studentId: '' });
export function openStudentProfile(studentId) {
  studentProfileUi.studentId = studentId;
  studentProfileUi.open = true;
}
export function closeStudentProfile() {
  studentProfileUi.open = false;
}
