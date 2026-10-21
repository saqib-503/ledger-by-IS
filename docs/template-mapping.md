# Template mapping

The original workbooks are retained verbatim in templates/. No print area or repeating rows are defined in either source. Both use portrait layout, margins 0.7 inches left/right and 0.75 top/bottom, 30.7 pt rows (invoice row 13: 47.85). Invoice specifies A4 at 53%; quotation scale is 69%, with no explicit paper size; exports use A4.

## Invoice Template
Company: B2 name; B4/B5 address lines; B6/B7 phones; B9 NTN. Document: K4 date (merged K4:L4); K5 number (K5:L5). Recipient: B12 name, B13 address, B14 NTN, B15 STRN. Header row 17. Items rows 18–29: B:G description, H HS.Code, I Quantity, J:K Avg Rate, L Amount. Twelve styled rows; extra rows inserted before row 30, with all subsequent merges and formulas shifted. Row 30 is a spacer, not an item.

L18 formula IF(OR(I18="",J18=""),"",I18*J18). L31 SUM(L18:L29); L32 L31*18%; L33 L31+L32; L34 L33*0.5%; L36 L33+L34. Advance tax is applied to the value INCLUDING sales tax. No ROUND in source: preserve exact decimal arithmetic (quantity/rate up to 4 decimal places, taxes up to 4), and display using original number formats. Never round intermediate tax amounts to whole currency units.

B32 OTHER COMMENTS; B33 bank detail heading; B34 bank name; B35 branch; B36 account title; B37 account number. E41:J41 thank-you footer. Notes and additional settings fields use available blank rows below bank details when populated. Company settings are snapshotted on documents to preserve historical exports.

## Quotation Template
Company B2 name; B4/B5 address; B6/B7 phones. Date I4. Recipient B10:D10. Title B11:I12. Header row 14; item rows 15–19: B:F Description, G Quantity, H:I Rate. There is NO amount column and NO totals or tax formulas. Five styled rows; insert extras before row 20, shifting declaration and footer. New quotation number goes in G5:I5 (blank source area), required by the brief. Additional recipient details may use blank row 13.

B21:I21 Declaration heading, B22:I25 declaration text; D28:G28 thank-you footer. Source declaration says 60% advance AND remaining balance (60%). Preserve this exact wording as editable default, and flag the apparent inconsistency rather than silently changing it.

## Source discrepancies
The company addresses differ between templates. Settings provide separate invoice and quotation addresses initialized from their respective source files. Sample recipients and sample products are never used as live customer data. Full merge/style metadata is read from the original workbook during export; only input cells and extended item/footer ranges are changed.

## Display precision
Invoice quantity and rate use #,##0; amount uses PKR #,##0.00; totals use #,##0. Screen summary totals therefore display whole PKR, with exact decimals retained in storage. Quotation rates use PKR #,##0.00 and quantities use General. Entered decimal invoice quantities/rates retain four decimal places internally even when the original template displays whole numbers.
