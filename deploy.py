import os
import subprocess
import sys

def main():
    print("=" * 60)
    print("⚡ VELMIRE AUTOMATED CLOUD DEPLOYER (by Ryukinnn)")
    print("=" * 60)
    print("\nScript ini akan mengunggah backend secara otomatis ke Cloud Server.")
    print("Komputer Anda TIDAK AKAN menjadi server.\n")

    token = input("Masukkan GitHub / Hugging Face Access Token Anda: ").strip()
    if not token:
        print("❌ Token tidak boleh kosong!")
        sys.exit(1)

    repo_name = input("Masukkan Nama Repository (Contoh: velmire-clip-backend): ").strip() or "velmire-clip-backend"
    username = input("Masukkan Username GitHub / HuggingFace Anda: ").strip()

    if not username:
        print("❌ Username tidak boleh kosong!")
        sys.exit(1)

    print("\n[1/3] Menginisialisasi Git Repository...")
    subprocess.run(["git", "init"], cwd=".", check=False)
    subprocess.run(["git", "add", "."], cwd=".", check=False)
    subprocess.run(["git", "commit", "-m", "Deploy Velmire Cloud Server"], cwd=".", check=False)
    subprocess.run(["git", "branch", "-M", "main"], cwd=".", check=False)

    print("\n[2/3] Mengunggah Kode ke Cloud Repository...")
    remote_url = f"https://{username}:{token}@github.com/{username}/{repo_name}.git"
    
    subprocess.run(["git", "remote", "remove", "origin"], cwd=".", check=False)
    subprocess.run(["git", "remote", "add", "origin", remote_url], cwd=".", check=False)
    
    result = subprocess.run(["git", "push", "-u", "origin", "main", "--force"], cwd=".")

    if result.returncode == 0:
        print("\n" + "=" * 60)
        print("✅ BERHASIL UPLOAD KE CLOUD!")
        print("=" * 60)
        print(f"URL Repository Cloud Anda: https://github.com/{username}/{repo_name}")
        print("\nSekarang masuk ke https://render.com -> New Web Service -> Sambungkan repo di atas.")
        print("Server Anda akan ONLINE 24/7 di Cloud secara otomatis!")
    else:
        print("\n❌ Gagal mengunggah. Pastikan Token & Username sudah benar.")

if __name__ == "__main__":
    main()
