---
title: "<% tp.system.prompt("Booking title") %>"
created: <% tp.date.now("YYYY-MM-DD") %>
type: booking
booking_type: <% tp.system.prompt("Booking type (accommodation/flight/activity/transport/dining)") %>
status: pending
project: "[[<% tp.system.prompt("Project") %>]]"
booking_ref: ""
provider: ""
date: <% tp.system.prompt("Booking date (YYYY-MM-DD)") %>
cost: 0
currency: AUD
payment_status: unpaid
cancellation_deadline:
tags:
  - booking
---

# <% tp.system.prompt("Booking title") %>

> **Booking** = Confirmed reservation linked to [[<% tp.system.prompt("Project") %>]]

## Booking Details

| Field | Value |
|-------|-------|
| **Booking Ref** |  |
| **Provider** |  |
| **Date** | <% tp.system.prompt("Booking date (YYYY-MM-DD)") %> |
| **Status** | Pending |

## Cost & Payment

| Field | Value |
|-------|-------|
| **Total Cost** |  |
| **Payment Status** | Unpaid |
| **Cancellation Deadline** |  |

## Contact Information

- **Phone**:
- **Email**:
- **Website**:

## Confirmation Details

<!-- Paste or summarize confirmation details here -->



## Important Notes

<!-- Check-in times, requirements, restrictions -->



## Attachments

<!-- Link to PDFs, emails, screenshots -->

-

---

**Related**: [[<% tp.system.prompt("Project") %>]]
