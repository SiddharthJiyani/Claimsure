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
_Requires Auth_

### 1.4 Logout

**POST** `/auth/logout`
_Requires Auth_

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
_Requires Auth_

### 2.2 Get Case Detail

Get full case details including documents, denials, appeals, and audit trail.

**GET** `/cases/:id`
_Requires Auth_

### 2.3 Create Case

**POST** `/cases`
_Requires Auth (insurance_provider only)_

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
_Requires Auth (insurance_provider only)_

**Request Body:**

```json
{
  "status": "ANALYZING"
}
```

### 2.5 Trigger AI Agent

Triggers the AI processing for a case.

**POST** `/cases/:id/process`
_Requires Auth (insurance_provider only)_
_Requires Header: `Idempotency-Key`_

**Request Body:**

```json
{
  "dry_run": false
}
```

### 2.6 Get Case Audit Trail

**GET** `/cases/:id/audit`
_Requires Auth_

---

## 3. Documents Endpoints

### 3.1 List Documents for Case

**GET** `/cases/:id/documents`
_Requires Auth_

### 3.2 Register Document Metadata

**POST** `/cases/:id/documents`
_Requires Auth_

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
_Requires Auth (insurance_provider only)_

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
_Requires Auth_

### 4.2 Create Appeal

**POST** `/cases/:id/appeal`
_Requires Auth (insurance_provider only)_

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
_Requires Auth (insurance_provider only)_

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
_Requires Auth_

### 5.2 Mark Notification Read

**PATCH** `/notifications/:id/read`
_Requires Auth_

### 5.3 Mark All Read

**PATCH** `/notifications/read-all`
_Requires Auth_

---

## 6. Eval Endpoints

### 6.1 Get Eval Results

**GET** `/eval/results`
_Requires Auth (insurance_provider only)_

### 6.2 Health Check

**GET** `/eval/health`

---

## 7. Webhooks Endpoints

### 7.1 Slack Webhook

**POST** `/webhooks/slack`
_Content-Type: application/x-www-form-urlencoded_
