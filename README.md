# Logo/Text on Video API

A FastAPI server that overlays logos or text on videos using FFmpeg, with a Next.js frontend for visual positioning.

## Features

- **Logo overlay** - Add PNG logos to videos at any position and size
- **Text overlay** - Add custom text with configurable font size and color
- **Visual editor** - Drag and resize overlays in real-time preview
- **Metadata stripping** - Output videos are clean for social media (TikTok, Instagram, YouTube)
- **CORS enabled** - Ready for frontend integration

## Quick Start

### Backend (FastAPI)

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn main:app --reload --port 8000
uvicorn main:app --host 0.0.0.0 --port 8080 --workers 4
```

### Frontend (Next.js)

```bash
cd frontend
pnpm install
pnpm dev --port 3001
```

## Requirements

- Python 3.8+
- FFmpeg (must be installed and in PATH)
- Node.js 18+ (for frontend)

### Install FFmpeg

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows (via Chocolatey)
choco install ffmpeg
```

## API Usage

### POST `/overlay`

Overlay a logo or text on a video.

**Parameters (multipart/form-data):**

| Parameter    | Type    | Required | Description |
|--------------|---------|----------|-------------|
| video        | File    | Yes      | Video file to process |
| logo         | File    | No*      | PNG logo to overlay |
| text         | String  | No*      | Text to overlay |
| x            | Integer | Yes      | X position (pixels) |
| y            | Integer | Yes      | Y position (pixels) |
| size         | Integer | Yes      | Width for logo / font size for text |
| font_color   | String  | No       | Text color (default: white) |

*Either `logo` OR `text` must be provided.

### Example

```bash
curl -X POST "http://localhost:8000/overlay" \
  -F "video=@input.mp4" \
  -F "logo=@logo.png" \
  -F "x=50" \
  -F "y=50" \
  -F "size=100" \
  --output result.mp4
```

## Documentation

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for full API details.

## License

MIT
