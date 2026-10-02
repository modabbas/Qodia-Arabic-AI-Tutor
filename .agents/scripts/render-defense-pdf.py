import sys
from pathlib import Path
import pymupdf as fitz

document = fitz.open(sys.argv[1])
output = Path("/tmp/kodia-defense-pdf-preview.png")
document[0].get_pixmap(matrix=fitz.Matrix(1.7, 1.7)).save(output)
print(f"Pages: {len(document)}; first-page image: {output}")
for index, page in enumerate(document):
    if not page.get_text().strip():
        raise RuntimeError(f"Page {index + 1} has no extractable text")
print("All pages contain text.")