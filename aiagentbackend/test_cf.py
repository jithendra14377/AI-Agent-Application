from dotenv import load_dotenv
load_dotenv()
from agent import fetch_image
data, ext = fetch_image("A modern office desk with a laptop showing code, warm light, purple and blue palette")
open("test_cf" + ext, "wb").write(data)
print("WORKS", len(data), "bytes")

