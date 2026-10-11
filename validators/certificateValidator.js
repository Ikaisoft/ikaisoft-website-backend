export const sanitizeText = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") value = String(value);
  return value.trim().replace(/\s+/g, " ");
};

export const sanitizeEmail = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") value = String(value);
  return value.replace(/^mailto:/i, "").trim().toLowerCase();
};

export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || "");

export const validateCollegePayload = (payload) => {
  const errors = [];
  const name = sanitizeText(payload.name);
  const code = sanitizeText(payload.code);
  const coordinatorEmail = sanitizeEmail(payload.coordinatorEmail || "");

  if (!name) errors.push("College name is required.");
  if (!code) errors.push("College code is required.");
  if (coordinatorEmail && !isValidEmail(coordinatorEmail)) errors.push("Coordinator email is invalid.");

  return {
    valid: errors.length === 0,
    errors,
    data: {
      name,
      code,
      address: sanitizeText(payload.address || ""),
      coordinatorName: sanitizeText(payload.coordinatorName || ""),
      coordinatorEmail,
      phone: sanitizeText(payload.phone || ""),
      status: payload.status || "Active",
      createdDate: payload.createdDate ? new Date(payload.createdDate) : new Date(),
    },
  };
};

export const validateStudentCertificatePayload = (payload) => {
  const errors = [];
  const studentName = sanitizeText(payload.studentName);
  const email = sanitizeEmail(payload.email || "");
  const courseName = sanitizeText(payload.courseName || "Professional Training Program");

  if (!studentName) errors.push("Student name is required.");
  if (!email || !isValidEmail(email)) errors.push("A valid student email is required.");

  return {
    valid: errors.length === 0,
    errors,
    data: {
      studentName,
      email,
      phone: sanitizeText(payload.phone || ""),
      courseName,
      courseDuration: sanitizeText(payload.courseDuration || "4 Weeks"),
      completionDate: payload.completionDate ? new Date(payload.completionDate) : new Date(),
      grade: sanitizeText(payload.grade || "A"),
      college: sanitizeText(payload.college || "Ikaisoft"),
      collegeId: payload.collegeId || null,
      status: payload.status || "Issued",
      issuedDate: payload.issuedDate ? new Date(payload.issuedDate) : new Date(),
      remarks: sanitizeText(payload.remarks || ""),
    },
  };
};
