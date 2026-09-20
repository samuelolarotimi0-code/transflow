import os
import yt_dlp

def download_video(url, output_folder_name="downloads"):
    # Convert relative folder name to absolute path
    output_path = os.path.abspath(output_folder_name)

    # Ensure output directory exists safely
    os.makedirs(output_path, exist_ok=True)

    options = {
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'outtmpl': os.path.join(output_path, '%(title)s.%(ext)s'),
        'progress_hooks': [progress_hook],
    }

    print(f"Starting download for: {url}")
    try:
        with yt_dlp.YoutubeDL(options) as ydl:
            ydl.download([url])
        print("\nDownload complete!")
    except Exception as e:
        print(f"\nAn error occurred: {e}")

def progress_hook(d):
    if d['status'] == 'downloading':
        percent = d.get('_percent_str', '').strip()
        eta = d.get('_eta_str', '').strip()
        print(f"\rProgress: {percent} | ETA: {eta}", end="")

if __name__ == "__main__":
    video_url = input("Enter YouTube URL: ").strip()
    if video_url:
        download_video(video_url)