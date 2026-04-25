"""Download the 3 real datasets AXIOM uses for demo."""
import os
import urllib.request
import zipfile
import io

DATASETS_DIR = os.path.join(os.path.dirname(__file__), "..", "datasets")
os.makedirs(DATASETS_DIR, exist_ok=True)


def download_adult():
    """UCI Adult Income — 48,842 rows."""
    url = "https://archive.ics.uci.edu/static/public/2/adult.zip"
    print(f"Downloading Adult Income from {url} ...")
    with urllib.request.urlopen(url) as r:
        data = r.read()
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        z.extractall(DATASETS_DIR)
    print("  -> extracted to datasets/")


def download_compas():
    """COMPAS Recidivism — ProPublica canonical CSV."""
    url = (
        "https://raw.githubusercontent.com/propublica/compas-analysis/"
        "master/compas-scores-two-years.csv"
    )
    dest = os.path.join(DATASETS_DIR, "compas_recidivism.csv")
    print(f"Downloading COMPAS from {url} ...")
    urllib.request.urlretrieve(url, dest)
    print(f"  -> {dest}")


def download_german():
    """German Credit — UCI Statlog."""
    url = "https://archive.ics.uci.edu/static/public/144/statlog+german+credit+data.zip"
    print(f"Downloading German Credit from {url} ...")
    with urllib.request.urlopen(url) as r:
        data = r.read()
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        z.extractall(os.path.join(DATASETS_DIR, "german_credit"))
    print("  -> extracted to datasets/german_credit/")


if __name__ == "__main__":
    download_adult()
    download_compas()
    download_german()
    print("\nAll datasets ready.")
