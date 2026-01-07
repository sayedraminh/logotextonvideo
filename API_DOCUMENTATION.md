# Video Logo Overlay API Documentation

A FastAPI server that overlays logos or text on videos using FFmpeg.

---

## Overview

This API accepts a video file along with either a PNG logo or text, plus position/size parameters. It uses FFmpeg to overlay the content at the specified coordinates and returns the processed video.

---

## Base URL

```
http://localhost:8000
```

---

## Endpoints

### POST `/overlay`

Overlays a logo (PNG) or text on a video at a specified position and size.

#### Request

**Content-Type:** `multipart/form-data`

| Parameter    | Type   | Required | Description |
|--------------|--------|----------|-------------|
| `video`      | File   | Yes      | Video file to process (mp4, mov, etc.) |
| `logo`       | File   | No*      | PNG logo file to overlay |
| `text`       | String | No*      | Text to overlay on the video |
| `x`          | Integer| Yes      | X position (pixels from left edge) |
| `y`          | Integer| Yes      | Y position (pixels from top edge) |
| `size`       | Integer| Yes      | Width of logo (px) OR font size for text |
| `font_color` | String | No       | Text color (default: "white"). Accepts color names or hex codes |

> *Either `logo` OR `text` must be provided, but not both.

#### Response

**Success (200):**
- Returns the processed video file as `video/mp4`
- Filename: `processed_{original_filename}`

**Error (400):**
```json
{
  "detail": "Either logo or text must be provided"
}
```

**Error (500):**
```json
{
  "detail": "FFmpeg error: {error_message}"
}
```

---

### GET `/health`

Health check endpoint.

#### Response

```json
{
  "status": "healthy"
}
```

---

## Example Usage

### cURL - Logo Overlay

```bash
curl -X POST "http://localhost:8000/overlay" \
  -F "video=@input.mp4" \
  -F "logo=@logo.png" \
  -F "x=50" \
  -F "y=50" \
  -F "size=100" \
  --output result.mp4
```

### cURL - Text Overlay

```bash
curl -X POST "http://localhost:8000/overlay" \
  -F "video=@input.mp4" \
  -F "text=My Watermark" \
  -F "x=100" \
  -F "y=100" \
  -F "size=48" \
  -F "font_color=yellow" \
  --output result.mp4
```

### JavaScript/Fetch

```javascript
const formData = new FormData();
formData.append("video", videoFile);
formData.append("logo", logoFile);
formData.append("x", "50");
formData.append("y", "50");
formData.append("size", "100");

const response = await fetch("http://localhost:8000/overlay", {
  method: "POST",
  body: formData,
});

if (response.ok) {
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  // Use url for video playback or download
}
```

---

## How It Works

1. **Upload:** Client sends video + logo/text + position parameters via multipart form
2. **Process:** Server saves files temporarily, then runs FFmpeg:
   - **Logo:** Uses `overlay` filter to composite PNG at x,y position with specified width
   - **Text:** Uses `drawtext` filter to render text at x,y with specified font size
3. **Return:** Server streams the processed video back to the client
4. **Cleanup:** Temp files are cleaned up on server shutdown

### FFmpeg Commands Used

**Logo overlay:**
```bash
ffmpeg -y -i input.mp4 -i logo.png \
  -filter_complex "[1:v]scale={size}:-1[logo];[0:v][logo]overlay={x}:{y}" \
  -map_metadata -1 -fflags +bitexact -flags:v +bitexact -flags:a +bitexact \
  -c:a aac -b:a 192k output.mp4
```

**Text overlay:**
```bash
ffmpeg -y -i input.mp4 \
  -vf "drawtext=text='{text}':x={x}:y={y}:fontsize={size}:fontcolor={font_color}" \
  -map_metadata -1 -fflags +bitexact -flags:v +bitexact -flags:a +bitexact \
  -c:a aac -b:a 192k output.mp4
```

### Metadata Stripping

All output videos have metadata stripped for social media compatibility:
- `-map_metadata -1` - Removes all metadata (encoder info, timestamps, etc.)
- `-fflags +bitexact` - Produces reproducible output without unique identifiers
- `-flags:v/a +bitexact` - Removes encoder-specific markers from video/audio streams
- Audio is re-encoded to AAC to strip embedded metadata

---

## Requirements

- **Python 3.8+**
- **FFmpeg** must be installed and available in PATH
- Python packages: `fastapi`, `uvicorn`, `python-multipart`

### Install FFmpeg

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows (via Chocolatey)
choco install ffmpeg
```

---

## Running the Server

```bash
# Install dependencies
pip install -r requirements.txt

# Start server
uvicorn main:app --reload --port 8000
```

---

## Notes

- The `size` parameter controls **width** for logos (height scales proportionally) and **font size** for text
- Position coordinates (x, y) are in **pixels** from the video's top-left corner
- Audio is preserved from the original video (`-c:a copy`)
- CORS is enabled for all origins (configurable in `main.py`)
- Swagger docs available at `http://localhost:8000/docs`
