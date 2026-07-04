#!/bin/bash
# Setup udev rules for USB thermal printer access on Linux

echo "========================================"
echo "Setting up USB udev rules for thermal printers"
echo "========================================"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "This script must be run as root (use sudo)"
  exit 1
fi

# Create udev rule for USB devices
RULE_FILE="/etc/udev/rules.d/99-thermal-printer.rules"

echo "Creating udev rule file: $RULE_FILE"
cat > "$RULE_FILE" << 'EOF'
# USB thermal printer access rules
# Allows all users to access USB devices (for development)
SUBSYSTEM=="usb", MODE="0666"
# More specific rule for thermal printers (common VID/PIDs)
SUBSYSTEM=="usb", ATTRS{idVendor}=="04f9", MODE="0666"
SUBSYSTEM=="usb", ATTRS{idVendor}=="04e8", MODE="0666"
SUBSYSTEM=="usb", ATTRS{idVendor}=="0519", MODE="0666"
EOF

echo "Rule file created successfully"
echo ""

# Reload udev rules
echo "Reloading udev rules..."
udevadm control --reload-rules
udevadm trigger

echo ""
echo "========================================"
echo "Setup complete!"
echo "========================================"
echo ""
echo "You may need to:"
echo "  1. Unplug and replug your USB printer"
echo "  2. Or reboot your system"
echo ""
echo "To verify permissions, run:"
echo "  ls -l /dev/bus/usb/*/*"

