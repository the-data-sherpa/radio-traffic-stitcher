# Maintainer: Your Name <your@email.com>
pkgname=radio-traffic-stitcher
pkgver=0.1.0
pkgrel=1
pkgdesc="Cross-platform audio clip stitcher"
arch=('x86_64')
url="https://github.com/yourusername/radio-traffic-stitcher"
license=('MIT')
depends=('webkit2gtk-4.1' 'ffmpeg')
makedepends=('rust' 'cargo' 'nodejs' 'npm')
source=()

build() {
  cd "$srcdir/.."
  npm install
  npm run tauri build
}

package() {
  cd "$srcdir/.."
  
  # Install binary
  install -Dm755 "src-tauri/target/release/radio-traffic-stitcher" \
    "$pkgdir/usr/bin/radio-traffic-stitcher"
  
  # Install desktop file
  install -Dm644 /dev/stdin "$pkgdir/usr/share/applications/radio-traffic-stitcher.desktop" << EOF
[Desktop Entry]
Name=Radio Traffic Stitcher
Comment=Combine audio clips into MP3
Exec=radio-traffic-stitcher
Icon=radio-traffic-stitcher
Terminal=false
Type=Application
Categories=AudioVideo;Audio;
EOF
}
