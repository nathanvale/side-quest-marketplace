---
title: "<% tp.system.prompt("Invoice title") %>"
created: <% tp.date.now("YYYY-MM-DD") %>
type: invoice
invoice_date: <% tp.system.prompt("Invoice date (YYYY-MM-DD)") %>
area: <% tp.system.prompt("Area (leave empty if using project)", "") %>
project: <% tp.system.prompt("Project (leave empty if using area)", "") %>
provider: "<% tp.system.prompt("Provider name") %>"
amount: <% tp.system.prompt("Amount", "0") %>
currency: <% tp.system.prompt("Currency", "AUD") %>
status: <% tp.system.prompt("Status (unpaid/paid/pending)", "unpaid") %>
due_date: <% tp.system.prompt("Due date (YYYY-MM-DD)", "") %>
payment_date:
tags:
  - invoice
template_version: 1
---

# <% tp.system.prompt("Invoice title") %>

> **Invoice** from `= this.provider` | `= this.amount` `= this.currency` | **`= this.status`**

## Invoice Details

| Field | Value |
|-------|-------|
| **Invoice Date** | `= this.invoice_date` |
| **Due Date** | `= this.due_date` |
| **Amount** | `= this.amount` `= this.currency` |
| **Status** | `= this.status` |
| **Provider** | `= this.provider` |

## Payment Details

<!-- Bank details, payment method, reference number -->



## Claim Details

<!-- Medicare/health insurance claim info if applicable -->



## Attachments

<!-- Link to invoice PDF -->

-

## Notes

<!-- Any additional notes about this invoice -->


