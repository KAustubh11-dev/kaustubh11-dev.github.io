import fitz
import os

pdf_paths = [
    "documents-v/Supreme Villagio Op Doc.pdf",
    "documents-v/Villagio_4 BHK Town Houses Floor Plans_15 Jan.pdf"
]

out_dir = "assets/images/pages"
os.makedirs(out_dir, exist_ok=True)

for path in pdf_paths:
    print(f"Processing {path}")
    try:
        doc = fitz.open(path)
        base = os.path.basename(path).split(".")[0]
        for page_num in range(len(doc)):
            page = doc[page_num]
            pix = page.get_pixmap(dpi=150)
            image_name = f"{base}_page_{page_num+1}.png"
            pix.save(os.path.join(out_dir, image_name))
            print(f"Rendered {image_name}")
    except Exception as e:
        print(f"Failed on {path}: {e}")
