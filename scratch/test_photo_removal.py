import os
from PIL import Image

def get_pixel(pixels, x, y, width):
    return pixels[x, y]

def process_image(img_path, output_path, threshold=55):
    # Open image
    img = Image.open(img_path)
    img = img.convert('RGB')
    
    # Scale down to max 400px (like our JS code)
    max_dim = 400
    w, h = img.size
    if w > max_dim or h > max_dim:
        if w > h:
            h = int((h * max_dim) / w)
            w = max_dim
        else:
            w = int((w * max_dim) / h)
            h = max_dim
        img = img.resize((w, h), Image.Resampling.LANCZOS)
    
    pixels = img.load()
    width, height = img.size
    
    # Sample background color from corners and top-middle
    samples = [
        get_pixel(pixels, 0, 0, width),
        get_pixel(pixels, width - 1, 0, width),
        get_pixel(pixels, 0, min(10, height - 1), width),
        get_pixel(pixels, width - 1, min(10, height - 1), width),
        get_pixel(pixels, int(width / 2), 0, width)
    ]
    
    bg_r = sum(s[0] for s in samples) // len(samples)
    bg_g = sum(s[1] for s in samples) // len(samples)
    bg_b = sum(s[2] for s in samples) // len(samples)
    
    print(f"Detected background color: RGB({bg_r}, {bg_g}, {bg_b})")
    
    # BFS queue for flood fill
    visited = [0] * (width * height)
    queue = []
    
    # Initialize queue with border pixels
    for x in range(width):
        queue.append((x, 0))
        visited[0 * width + x] = 1
    for y in range(1, height):
        queue.append((0, y))
        queue.append((width - 1, y))
        visited[y * width + 0] = 1
        visited[y * width + (width - 1)] = 1
        
    def is_color_similar(r, g, b):
        dr = r - bg_r
        dg = g - bg_g
        db = b - bg_b
        import math
        return math.sqrt(dr*dr + dg*dg + db*db) < threshold

    # Create new output image with RGBA
    out_img = Image.new('RGBA', (width, height), (255, 255, 255, 255))
    out_pixels = out_img.load()
    
    # Copy original to output first
    for y in range(height):
        for x in range(width):
            r, g, b = pixels[x, y]
            out_pixels[x, y] = (r, g, b, 255)
            
    head = 0
    while head < len(queue):
        x, y = queue[head]
        head += 1
        r, g, b = pixels[x, y]
        
        if is_color_similar(r, g, b):
            # Mark as background (turn white)
            out_pixels[x, y] = (255, 255, 255, 255)
            
            # Neighbors
            neighbors = [
                (x - 1, y),
                (x + 1, y),
                (x, y - 1),
                (x, y + 1)
            ]
            for nx, ny in neighbors:
                if 0 <= nx < width and 0 <= ny < height:
                    n_idx = ny * width + nx
                    if not visited[n_idx]:
                        visited[n_idx] = 1
                        queue.append((nx, ny))
                        
    out_img.save(output_path, 'PNG')
    print("Image processed and saved.")

# Run processing
img_dir = r"C:\Users\salim\.gemini\antigravity\brain\7dbd627f-6ee4-40d8-8e11-80bf7ab183a3"
process_image(
    os.path.join(img_dir, "media__1782372962202.jpg"),
    os.path.join(img_dir, "media__1782372962202_processed.png")
)
