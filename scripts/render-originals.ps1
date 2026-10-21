$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
 foreach ($name in @('Invoice','Quotation')) {
  $book = $excel.Workbooks.Open((Join-Path (Get-Location) "templates/$name.xlsx"), 0, $true)
  $book.ExportAsFixedFormat(0,(Join-Path (Get-Location) "artifacts/original-$name.pdf"))
  $book.Close($false)
 }
} finally { $excel.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null }
