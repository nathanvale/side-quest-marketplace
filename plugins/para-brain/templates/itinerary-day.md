---
title: "<% tp.system.prompt("Day title") %>"
created: <% tp.date.now("YYYY-MM-DD") %>
type: itinerary
project: "[[<% tp.system.prompt("Project") %>]]"
trip_date: <% tp.system.prompt("Trip date (YYYY-MM-DD)") %>
day_number: <% tp.system.prompt("Day number") %>
location: ""
accommodation: ""
checkout_time:
checkin_time:
energy_level: medium
tags:
  - itinerary
---

# <% tp.system.prompt("Day title") %>

> **Day <% tp.system.prompt("Day number") %>** of [[<% tp.system.prompt("Project") %>]]

## Overview

| Field | Value |
|-------|-------|
| **Date** | <% tp.system.prompt("Trip date (YYYY-MM-DD)") %> |
| **Location** | |
| **Accommodation** | |
| **Energy Level** | Medium |

## Morning

- [ ]

## Afternoon

- [ ]

## Evening

- [ ]

## Meals

| Meal | Plan | Booked? |
|------|------|---------|
| Breakfast | | |
| Lunch | | |
| Dinner | | |

## Transport

<!-- Driving times, transfers, logistics -->



## What to Bring

- [ ]

## Important Notes

<!-- Weather, reservations, timing -->



## Bookings for Today

<!-- Link to relevant booking notes -->

-

---

**Navigation**: ← Previous Day | [[<% tp.system.prompt("Project") %>]] | Next Day →
