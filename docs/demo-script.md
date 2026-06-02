# Demo Script

Scenario: A 30-day return window and 1-year warranty no longer disappear in the inbox.

1. Open the app locally.
2. Show the seeded deadline queue with Wireless Headset, Phone Case, and Coffee Maker.
3. Paste this receipt into the parser:

```text
Example Electronics
Receipt 7142
2026-06-02
Wireless Headset 129.99
Phone Case 24.99
Subtotal 154.98
Tax 12.01
Total 166.99
```

4. Click `Parse receipt`.
5. Confirm the two detected line items.
6. Click `Add selected items`.
7. Show that each item now has separate return, refund, and warranty deadlines.
8. Select Wireless Headset in the queue.
9. Export the evidence pack.
10. Export `.ics` calendar reminders.
11. Export JSON backup to show data portability.

Expected message: the app turns receipts into an actionable local deadline queue without uploading purchase data.
