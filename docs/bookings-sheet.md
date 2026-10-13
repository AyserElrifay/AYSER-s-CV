# Bookings → a Google Sheet the team can edit

Every booking on Moments, and every change to its status, lands as a row in a
Google Sheet that you own and share with your team.

1. Make a new Google Sheet (sheets.new). Name it **Moments bookings**.
2. In the sheet: **Extensions → Apps Script**. Delete what is there and paste:

```js
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['When', 'Code', 'Trip', 'Name', 'People', 'Total', 'Currency', 'Pays', 'Status', 'Note', 'Photos OK', 'Event']);
  }
  var b = JSON.parse(e.postData.contents);
  sheet.appendRow([b.booked_at, b.code, b.trip, b.name, b.people, b.total, b.currency, b.pay, b.status, b.note || '', b.photo_ok ? 'yes' : 'no', b.event]);
  return ContentService.createTextOutput('ok');
}
```

3. **Deploy → New deployment → Web app**. Execute as: **Me**. Who has access: **Anyone**.
   Copy the address that ends in `/exec`.
4. Open the Studio (`?studio=1`) → **Offers** → **Bookings sheet**, paste the
   address and press **Save sheet address**.
5. Share the sheet with your team (Share → add their emails as Editors).

The address is the only key to the sheet's inbox — keep it in the Studio, not in
chat. To stop, clear the field and save.
