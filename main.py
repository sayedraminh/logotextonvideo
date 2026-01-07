import os
import uuid
import subprocess
import shutil
import logging
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Video Logo Overlay API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_DIR = Path("temp_files")
TEMP_DIR.mkdir(exist_ok=True)


@app.post("/overlay")
async def overlay_video(
    video: UploadFile = File(..., description="Video file to process"),
    logo: Optional[UploadFile] = File(None, description="PNG logo file"),
    text: Optional[str] = Form(None, description="Text to overlay"),
    x: int = Form(..., description="X position of overlay"),
    y: int = Form(..., description="Y position of overlay"),
    size: int = Form(..., description="Size of the overlay (width for logo, font size for text)"),
    font_color: str = Form("white", description="Font color for text overlay"),
):
    """
    Overlay a logo or text on a video at specified position and size.
    
    Either provide a logo file OR text, not both.
    """
    logger.info("=" * 60)
    logger.info("New overlay request received")
    logger.info(f"Video filename: {video.filename}")
    logger.info(f"Logo provided: {logo is not None}")
    logger.info(f"Text provided: {text}")
    logger.info(f"Position: x={x}, y={y}")
    logger.info(f"Size: {size}")
    logger.info(f"Font color: {font_color}")
    
    if not logo and not text:
        logger.error("Neither logo nor text provided")
        raise HTTPException(status_code=400, detail="Either logo or text must be provided")
    
    if logo and text:
        logger.error("Both logo and text provided")
        raise HTTPException(status_code=400, detail="Provide either logo or text, not both")

    request_id = str(uuid.uuid4())
    request_dir = TEMP_DIR / request_id
    request_dir.mkdir(exist_ok=True)
    logger.info(f"Request ID: {request_id}")
    logger.info(f"Working directory: {request_dir}")

    try:
        video_ext = Path(video.filename).suffix or ".mp4"
        video_path = request_dir / f"input{video_ext}"
        content = await video.read()
        with open(video_path, "wb") as f:
            f.write(content)
        logger.info(f"Video saved: {video_path} ({len(content)} bytes)")

        output_path = request_dir / f"output{video_ext}"

        if logo:
            logo_path = request_dir / "logo.png"
            logo_content = await logo.read()
            with open(logo_path, "wb") as f:
                f.write(logo_content)
            logger.info(f"Logo saved: {logo_path} ({len(logo_content)} bytes)")
            
            if len(logo_content) == 0:
                logger.error("Logo file is empty!")
                raise HTTPException(status_code=400, detail="Logo file is empty")

            filter_complex = f"[1:v]scale={size}:-1[logo];[0:v][logo]overlay={x}:{y}"
            logger.info(f"Filter complex: {filter_complex}")
            
            cmd = [
                "ffmpeg", "-y",
                "-i", str(video_path),
                "-i", str(logo_path),
                "-filter_complex", filter_complex,
                "-map_metadata", "-1",  # Strip all metadata
                "-fflags", "+bitexact",  # Reproducible output
                "-flags:v", "+bitexact",
                "-flags:a", "+bitexact",
                "-c:a", "aac",  # Re-encode audio to strip metadata
                "-b:a", "192k",
                str(output_path)
            ]
        else:
            filter_complex = (
                f"drawtext=text='{text}':"
                f"x={x}:y={y}:"
                f"fontsize={size}:"
                f"fontcolor={font_color}"
            )
            logger.info(f"Video filter: {filter_complex}")
            
            cmd = [
                "ffmpeg", "-y",
                "-i", str(video_path),
                "-vf", filter_complex,
                "-map_metadata", "-1",  # Strip all metadata
                "-fflags", "+bitexact",  # Reproducible output
                "-flags:v", "+bitexact",
                "-flags:a", "+bitexact",
                "-c:a", "aac",  # Re-encode audio to strip metadata
                "-b:a", "192k",
                str(output_path)
            ]

        logger.info(f"FFmpeg command: {' '.join(cmd)}")
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        logger.info(f"FFmpeg return code: {result.returncode}")
        if result.stdout:
            logger.debug(f"FFmpeg stdout: {result.stdout}")
        if result.stderr:
            logger.info(f"FFmpeg stderr: {result.stderr}")
        
        if result.returncode != 0:
            logger.error(f"FFmpeg failed with code {result.returncode}")
            raise HTTPException(
                status_code=500, 
                detail=f"FFmpeg error: {result.stderr}"
            )

        if not output_path.exists():
            logger.error("Output file was not created")
            raise HTTPException(status_code=500, detail="Failed to create output video")

        output_size = output_path.stat().st_size
        logger.info(f"Output video created: {output_path} ({output_size} bytes)")
        logger.info("=" * 60)

        return FileResponse(
            path=str(output_path),
            media_type="video/mp4",
            filename=f"processed_{video.filename}",
            background=None
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        pass


@app.on_event("shutdown")
async def cleanup():
    """Clean up temp files on shutdown."""
    if TEMP_DIR.exists():
        shutil.rmtree(TEMP_DIR)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
