import AppKit
import Foundation

// Full-bleed mark. iOS applies the squircle — never bake a border or corner radius.
let dim: CGFloat = 1024
let image = NSImage(size: NSSize(width: dim, height: dim))
image.lockFocus()
NSColor(red: 0.78, green: 0.96, blue: 0.22, alpha: 1).setFill()
NSRect(x: 0, y: 0, width: dim, height: dim).fill()
let text = "V" as NSString
let attrs: [NSAttributedString.Key: Any] = [
  .font: NSFont.systemFont(ofSize: 520, weight: .black),
  .foregroundColor: NSColor(red: 0.12, green: 0.10, blue: 0.08, alpha: 1),
]
let textSize = text.size(withAttributes: attrs)
text.draw(
  at: NSPoint(x: (dim - textSize.width) / 2, y: (dim - textSize.height) / 2 - 28),
  withAttributes: attrs
)
image.unlockFocus()

guard let tiff = image.tiffRepresentation,
      let rep = NSBitmapImageRep(data: tiff),
      let cg = rep.cgImage else {
  fatalError("Could not rasterize icon")
}

let colorSpace = CGColorSpaceCreateDeviceRGB()
guard let ctx = CGContext(
  data: nil,
  width: Int(dim),
  height: Int(dim),
  bitsPerComponent: 8,
  bytesPerRow: Int(dim) * 4,
  space: colorSpace,
  bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
) else {
  fatalError("Could not flatten icon")
}
ctx.draw(cg, in: CGRect(x: 0, y: 0, width: dim, height: dim))
guard let flat = ctx.makeImage() else { fatalError("Could not flatten icon") }
let outRep = NSBitmapImageRep(cgImage: flat)
guard let png = outRep.representation(using: .png, properties: [:]) else { fatalError("Could not encode PNG") }
try png.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
print("Wrote \(CommandLine.arguments[1])")
