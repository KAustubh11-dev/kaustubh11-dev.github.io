import fitz

doc = fitz.open("documents-v/Supreme Villagio Op Doc.pdf")
for i in range(len(doc)):
    text = doc[i].get_text().lower()
    if "somatane" in text and "mins" in text:
        print(f"Map might be on page {i+1}")
    if "location" in text:
        print(f"Location mentioned on page {i+1}")
