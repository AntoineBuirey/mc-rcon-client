#!/usr/bin/env bash

set -euo pipefail


case "$(uname -s)" in
	Linux)
		if [ -f /etc/alpine-release ]; then
			os=alpine
		elif [ -r /etc/os-release ]; then
			. /etc/os-release
			case "${ID:-}" in
				ubuntu) os=ubuntu ;;
				debian) os=debian ;;
				*)
					case " ${ID_LIKE:-} " in
						*\ ubuntu\ *) os=ubuntu ;;
						*\ debian\ *) os=debian ;;
						*) echo "OS non pris en charge" >&2; exit 1 ;;
					esac
					;;
			esac
		else
			echo "Unsupported Linux distribution" >&2
			exit 1
		fi
		;;
	*)
		echo "Unsupported OS: $(uname -s)" >&2
		exit 1
		;;
esac

archive="mc-rcon-panel-${os}.tar.gz"
url="https://github.com/AntoineBuirey/mc-rcon-client/releases/latest/download/${archive}"
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

if command -v curl >/dev/null 2>&1; then
	curl -fL "$url" -o "$tmpdir/$archive"
elif command -v wget >/dev/null 2>&1; then
	wget -O "$tmpdir/$archive" "$url"
else
	echo "curl ou wget est requis" >&2
	exit 1
fi




install_dir=/usr/local/bin/mc-rcon-panel
mkdir -p "$install_dir"
tar -xzf "$tmpdir/$archive" -C "$install_dir"

# create config file at /etc/mc-rcon-panel/config.json

mkdir -p /etc/mc-rcon-panel
echo {} > /etc/mc-rcon-panel/config.json

echo "Installation completed. Config file is located at /etc/mc-rcon-panel/config.json"

# ask the user if they want to create a service file for systemd or openrc

if [ -d /etc/systemd/system ]; then
    read -p "Do you want to create a systemd service file for mc-rcon-panel? (y/n) " answer
    if [ "$answer" = "y" ]; then
        cat <<EOF > /etc/systemd/system/mc-rcon-panel.service
[Unit]
Description=mc-rcon-panel service
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/mc-rcon-panel/mc-rcon-panel.bin
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
        systemctl daemon-reload
        echo "Systemd service file created at /etc/systemd/system/mc-rcon-panel.service"
        echo "You can start the service with: systemctl start mc-rcon-panel"
        echo "You can enable the service to start on boot with: systemctl enable mc-rcon-panel"
    fi
elif [ -d /etc/init.d ]; then
    read -p "Do you want to create an OpenRC service file for mc-rcon-panel? (y/n) " answer
    if [ "$answer" = "y" ]; then
        cat <<EOF > /etc/init.d/mc-rcon-panel
#!/sbin/openrc-run
name="mc-rcon-panel"
command="/usr/local/bin/mc-rcon-panel/mc-rcon-panel.bin"
command_background=true
depend() {
    need net
}
EOF
        chmod +x /etc/init.d/mc-rcon-panel
        echo "OpenRC service file created at /etc/init.d/mc-rcon-panel"
        echo "You can start the service with: rc-service mc-rcon-panel start"
        echo "You can enable the service to start on boot with: rc-update add mc-rcon-panel default"
    fi
else
    echo "No supported service manager found. Skipping service file creation."
fi


# add uninstall script to remove the installed files and service
if [ -f /usr/local/bin/mc-rcon-panel/uninstall.sh ]; then
    echo "Uninstall script already exists. Skipping creation."
else
    cat <<'EOF' > /usr/local/bin/mc-rcon-panel/uninstall.sh
#!/usr/bin/env bash

set -euo pipefail

# remove service file if it exists
if [ -f /etc/systemd/system/mc-rcon-panel.service ]; then
    systemctl stop mc-rcon-panel || true
    systemctl disable mc-rcon-panel || true
    rm -f /etc/systemd/system/mc-rcon-panel.service
    systemctl daemon-reload
    echo "Systemd service file removed."
elif [ -f /etc/init.d/mc-rcon-panel ]; then
    rc-service mc-rcon-panel stop || true
    rc-update del mc-rcon-panel || true
    rm -f /etc/init.d/mc-rcon-panel
    echo "OpenRC service file removed."
fi

# remove installed files
rm -rf /usr/local/bin/mc-rcon-panel

# remove config file
rm -rf /etc/mc-rcon-panel

# remove database file
rm -rf /var/lib/mc-rcon-panel

echo "mc-rcon-panel uninstalled successfully."
EOF
    chmod +x /usr/local/bin/mc-rcon-panel/uninstall.sh
    echo "Uninstall script created at /usr/local/bin/mc-rcon-panel/uninstall.sh"
    echo "You can uninstall mc-rcon-panel by running: /usr/local/bin/mc-rcon-panel/uninstall.sh"
fi