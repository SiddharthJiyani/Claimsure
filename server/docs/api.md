# Claimsure API Reference

## Base URL
Local Development: `http://localhost:5000/api`

## Authentication
Most endpoints require a Bearer token in the `Authorization` header.
```http
Authorization: Bearer <your_jwt_token>
```

## Idempotency
Endpoints that trigger side effects (e.g., triggering AI agents, external integrations) require an `Idempotency-Key` header.
```http
Idempotency-Key: <unique-string>
```

---

## 1. Authentication Endpoints

### 1.1 Sign Up
Create a new user account (patient or insurance_provider).

**POST** `/auth/signup`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "full_name": "John Doe",
  "role": "patient",
  "organization_id": "optional-uuid-for-insurers"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "session": { ... }
  },
  "message": "Account created. Please check your email for verification."
}
```

### 1.2 Login
Authenticate and get a session token.

**POST** `/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "session": { ... }
  },
  "message": "Login successful"
}
```

### 1.3 Get Me
Get current authenticated user profile.

**GET** `/auth/me`
*Requires Auth*

### 1.4 Logout
**POST** `/auth/logout`
*Requires Auth*

### 1.5 Reset Password
**POST** `/auth/reset-password`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

---

## 2. Cases Endpoints

### 2.1 List Cases
Get a paginated list of cases. Scoped by user role (patient sees their own, insurer sees org cases).

**GET** `/cases?status=PENDING&page=1&limit=20`
*Requires Auth*

### 2.2 Get Case Detail
Get full case details including documents, denials, appeals, and audit trail.

**GET** `/cases/:id`
*Requires Auth*

### 2.3 Create Case
**POST** `/cases`
*Requires Auth (insurance_provider only)*

**Request Body:**
```json
{
  "patient_id": "uuid",
  "insurer_org_id": "uuid",
  "service_type": "MRI",
  "service_code": "CPT-12345",
  "payer_id": "payer_a",
  "denial_reason": "Not medically necessary",
  "denial_code": "CO-50",
  "denial_date": "2026-09-01",
  "appeal_deadline": "2026-10-01"
}
```

### 2.4 Update Case Status
**PATCH** `/cases/:id`
*Requires Auth (insurance_provider only)*

**Request Body:**
```json
{
  "status": "ANALYZING"
}
```

### 2.5 Trigger AI Agent
Triggers the AI processing for a case.

**POST** `/cases/:id/process`
*Requires Auth (insurance_provider only)*
*Requires Header: `Idempotency-Key`*

**Request Body:**
```json
{
  "dry_run": false
}
```

### 2.6 Get Case Audit Trail
**GET** `/cases/:id/audit`
*Requires Auth*

---

## 3. Documents Endpoints

### 3.1 List Documents for Case
**GET** `/cases/:id/documents`
*Requires Auth*

### 3.2 Register Document Metadata
**POST** `/cases/:id/documents`
*Requires Auth*

**Request Body:**
```json
{
  "name": "Denial Letter.pdf",
  "document_type": "denial_letter",
  "drive_file_id": "google_drive_id",
  "is_missing": false
}
```

### 3.3 Mark Document as Missing/Found
**PATCH** `/cases/:id/documents/:docId/missing`
*Requires Auth (insurance_provider only)*

**Request Body:**
```json
{
  "is_missing": true
}
```

---

## 4. Appeals Endpoints

### 4.1 Get Appeal
**GET** `/cases/:id/appeal`
*Requires Auth*

### 4.2 Create Appeal
**POST** `/cases/:id/appeal`
*Requires Auth (insurance_provider only)*

**Request Body:**
```json
{
  "appeal_text": "We are appealing this denial because...",
  "citations": [
    {
      "policy_id": "payer_a_2026",
      "clause": "2.1",
      "text": "Prior auth obtained..."
    }
  ]
}
```

### 4.3 Update Appeal Status
**PATCH** `/cases/:id/appeal/:appealId`
*Requires Auth (insurance_provider only)*

**Request Body:**
```json
{
  "status": "APPROVED",
  "appeal_text": "Updated text..."
}
```

---

## 5. Notifications Endpoints

### 5.1 List Notifications
**GET** `/notifications?unread=true`
*Requires Auth*

### 5.2 Mark Notification Read
**PATCH** `/notifications/:id/read`
*Requires Auth*

### 5.3 Mark All Read
**PATCH** `/notifications/read-all`
*Requires Auth*

---

## 6. Eval Endpoints

### 6.1 Get Eval Results
**GET** `/eval/results`
*Requires Auth (insurance_provider only)*

### 6.2 Health Check
**GET** `/eval/health`

---

## 7. Webhooks Endpoints

### 7.1 Slack Webhook
**POST** `/webhooks/slack`
*Content-Type: application/x-www-form-urlencoded*
