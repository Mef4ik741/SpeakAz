from PIL import Image, ImageDraw, ImageFont
import os

# Создаем иконку 256x256
size = 256
img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Градиентный фон (упрощенный)
for y in range(size):
    r = int(25 + (92 - 25) * y / size)
    g = int(118 + (107 - 118) * y / size) 
    b = int(210 + (192 - 210) * y / size)
    draw.rectangle([(0, y), (size, y+1)], fill=(r, g, b, 255))

# Закругленные углы (упрощенно)
corner_radius = 32
draw.rectangle([(0, 0), (corner_radius, corner_radius)], fill=(0, 0, 0, 0))
draw.rectangle([(size-corner_radius, 0), (size, corner_radius)], fill=(0, 0, 0, 0))
draw.rectangle([(0, size-corner_radius), (corner_radius, size)], fill=(0, 0, 0, 0))
draw.rectangle([(size-corner_radius, size-corner_radius), (size, size)], fill=(0, 0, 0, 0))

# Микрофон
mic_x, mic_y = 108, 88
mic_w, mic_h = 40, 60

# Корпус микрофона
draw.rounded_rectangle([(mic_x, mic_y), (mic_x + mic_w, mic_y + mic_h)], 
                      radius=20, fill=(255, 255, 255, 230))

# Решетка
for i in range(5):
    y = mic_y + 10 + i * 10
    draw.line([(mic_x + 8, y), (mic_x + mic_w - 8, y)], 
             fill=(25, 118, 210, 255), width=2)

# Стойка
draw.rectangle([(126, 148), (130, 178)], fill=(255, 255, 255, 230))

# Основание
draw.ellipse([(103, 175), (153, 191)], fill=(255, 255, 255, 230))

# Звуковые волны (упрощенно)
wave_color = (255, 255, 255, 180)
draw.arc([(148, 93), (178, 123)], 315, 45, fill=wave_color, width=3)
draw.arc([(153, 88), (188, 128)], 315, 45, fill=(255, 255, 255, 120), width=3)

draw.arc([(78, 93), (108, 123)], 135, 225, fill=wave_color, width=3)
draw.arc([(68, 88), (103, 128)], 135, 225, fill=(255, 255, 255, 120), width=3)

# Сохраняем
icon_path = 'electron/assets/icon.png'
os.makedirs(os.path.dirname(icon_path), exist_ok=True)
img.save(icon_path, 'PNG')

# Создаем также иконку для трея 16x16
tray_img = img.resize((16, 16), Image.Resampling.LANCZOS)
tray_img.save('electron/assets/tray-icon.png', 'PNG')

print("Иконки созданы:")
print(f"- {icon_path}")
print("- electron/assets/tray-icon.png")
