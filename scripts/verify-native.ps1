$excel=New-Object -ComObject Excel.Application
$excel.Visible=$false
$excel.DisplayAlerts=$false
try {
 foreach($kind in @('invoice','quotation')) {
  $book=$excel.Workbooks.Open((Join-Path (Get-Location) "artifacts/$kind-1.xlsx"),0,$true)
  $book.ExportAsFixedFormat(0,(Join-Path (Get-Location) "artifacts/native-$kind.pdf"))
  if($kind -eq 'invoice'){ Write-Output "Excel recalculated invoice total: $($book.Worksheets.Item(1).Range('L36').Value2)" }
  $book.Close($false)
 }
} finally { $excel.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)|Out-Null }
