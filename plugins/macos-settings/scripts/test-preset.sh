#!/bin/bash
# test-preset.sh — Apply and verify macOS settings presets in VM
#
# Usage:
#   ./test-preset.sh server      # Apply server preset
#   ./test-preset.sh desktop     # Apply desktop-dev preset
#   ./test-preset.sh minimal     # Apply minimal preset
#   ./test-preset.sh presentation # Apply presentation preset
#   ./test-preset.sh verify      # Just verify current settings
#   ./test-preset.sh reset       # Reset to macOS defaults

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }
log_section() { echo -e "\n${BLUE}=== $1 ===${NC}"; }

# Detect macOS version
detect_version() {
    VERSION=$(sw_vers -productVersion)
    MAJOR=$(echo "$VERSION" | cut -d. -f1)

    if [[ "$MAJOR" == "15" ]]; then
        echo "Sequoia"
    elif [[ "$MAJOR" == "26" ]]; then
        echo "Tahoe"
    else
        echo "Unknown ($VERSION)"
    fi
}

# Check if a defaults value matches expected
check_default() {
    local domain="$1"
    local key="$2"
    local expected="$3"
    local description="$4"

    local actual
    actual=$(defaults read "$domain" "$key" 2>/dev/null || echo "NOT_SET")

    if [[ "$actual" == "$expected" ]]; then
        log_success "$description: $actual"
        return 0
    else
        log_error "$description: expected '$expected', got '$actual'"
        return 1
    fi
}

# Check pmset value
check_pmset() {
    local key="$1"
    local expected="$2"
    local description="$3"

    local actual
    actual=$(pmset -g | grep -E "^ $key" | awk '{print $2}' || echo "NOT_SET")

    if [[ "$actual" == "$expected" ]]; then
        log_success "$description: $actual"
        return 0
    else
        log_error "$description: expected '$expected', got '$actual'"
        return 1
    fi
}

# ============================================
# SERVER PRESET
# ============================================
apply_server() {
    log_section "Applying Server Preset"
    log_info "macOS Version: $(detect_version)"

    log_info "Configuring energy settings (requires sudo)..."
    sudo pmset -a sleep 0
    sudo pmset -a displaysleep 0
    sudo pmset -a disksleep 0
    sudo pmset -a womp 1
    sudo pmset -a autorestart 1
    sudo pmset -a powernap 0
    sudo pmset -a standby 0
    sudo pmset -a autopoweroff 0
    sudo pmset -a hibernatemode 0
    sudo pmset -a proximitywake 0
    sudo pmset -a tcpkeepalive 1

    log_info "Configuring screen saver..."
    defaults write com.apple.screensaver idleTime -int 0

    log_info "Configuring performance..."
    defaults write com.apple.universalaccess reduceMotion -bool true
    defaults write com.apple.universalaccess reduceTransparency -bool true
    defaults write com.apple.assistant.support "Assistant Enabled" -bool false
    defaults write NSGlobalDomain com.apple.sound.beep.feedback -bool false
    defaults write NSGlobalDomain NSAppSleepDisabled -bool true

    log_info "Configuring crash reporter..."
    defaults write com.apple.CrashReporter DialogType -string "none"

    log_info "Disabling hot corners..."
    defaults write com.apple.dock wvous-tl-corner -int 0
    defaults write com.apple.dock wvous-tr-corner -int 0
    defaults write com.apple.dock wvous-bl-corner -int 0
    defaults write com.apple.dock wvous-br-corner -int 0

    log_info "Restarting affected apps..."
    killall Dock 2>/dev/null || true
    killall SystemUIServer 2>/dev/null || true

    log_success "Server preset applied!"
}

verify_server() {
    log_section "Verifying Server Preset"
    local failures=0

    log_info "Checking energy settings..."
    check_pmset "sleep" "0" "System sleep" || ((failures++))
    check_pmset "displaysleep" "0" "Display sleep" || ((failures++))
    check_pmset "disksleep" "0" "Disk sleep" || ((failures++))
    check_pmset "womp" "1" "Wake on LAN" || ((failures++))
    check_pmset "autorestart" "1" "Auto restart" || ((failures++))
    check_pmset "powernap" "0" "Power Nap" || ((failures++))

    log_info "Checking screen saver..."
    check_default "com.apple.screensaver" "idleTime" "0" "Screen saver idle" || ((failures++))

    log_info "Checking performance..."
    check_default "com.apple.universalaccess" "reduceMotion" "1" "Reduce motion" || ((failures++))
    check_default "com.apple.universalaccess" "reduceTransparency" "1" "Reduce transparency" || ((failures++))

    log_info "Checking hot corners..."
    check_default "com.apple.dock" "wvous-tl-corner" "0" "Top-left corner" || ((failures++))
    check_default "com.apple.dock" "wvous-tr-corner" "0" "Top-right corner" || ((failures++))

    echo ""
    if [[ $failures -eq 0 ]]; then
        log_success "All server settings verified!"
    else
        log_error "$failures setting(s) failed verification"
    fi
    return $failures
}

# ============================================
# DESKTOP-DEV PRESET
# ============================================
apply_desktop() {
    log_section "Applying Desktop-Dev Preset"
    log_info "macOS Version: $(detect_version)"

    log_info "Configuring keyboard..."
    defaults write NSGlobalDomain KeyRepeat -int 1
    defaults write NSGlobalDomain InitialKeyRepeat -int 10
    defaults write NSGlobalDomain ApplePressAndHoldEnabled -bool false
    defaults write NSGlobalDomain AppleKeyboardUIMode -int 2
    defaults write NSGlobalDomain NSAutomaticSpellingCorrectionEnabled -bool false
    defaults write NSGlobalDomain NSAutomaticCapitalizationEnabled -bool false
    defaults write NSGlobalDomain NSAutomaticQuoteSubstitutionEnabled -bool false
    defaults write NSGlobalDomain NSAutomaticDashSubstitutionEnabled -bool false
    defaults write NSGlobalDomain NSAutomaticPeriodSubstitutionEnabled -bool false

    log_info "Configuring Finder..."
    defaults write com.apple.finder ShowPathbar -bool true
    defaults write com.apple.finder ShowStatusBar -bool true
    defaults write com.apple.finder _FXShowPosixPathInTitle -bool true
    defaults write NSGlobalDomain AppleShowAllExtensions -bool true
    defaults write com.apple.finder _FXSortFoldersFirst -bool true
    defaults write com.apple.finder FXPreferredViewStyle -string "clmv"
    defaults write com.apple.finder FXDefaultSearchScope -string "SCcf"
    defaults write com.apple.finder FXEnableExtensionChangeWarning -bool false

    log_info "Configuring Dock..."
    defaults write com.apple.dock autohide -bool true
    defaults write com.apple.dock autohide-delay -float 0
    defaults write com.apple.dock autohide-time-modifier -float 0.001
    defaults write com.apple.dock tilesize -int 16
    defaults write com.apple.dock static-only -bool true
    defaults write com.apple.dock show-recents -bool false
    defaults write com.apple.dock launchanim -bool false
    defaults write com.apple.dock mineffect -string "scale"

    log_info "Configuring Mission Control..."
    defaults write com.apple.spaces spans-displays -bool true
    defaults write com.apple.dock mru-spaces -bool false
    defaults write com.apple.dock expose-group-apps -bool true
    defaults write com.apple.dock expose-animation-duration -float 0.1

    log_info "Configuring hot corners (with Cmd modifier)..."
    defaults write com.apple.dock wvous-tl-corner -int 4
    defaults write com.apple.dock wvous-tl-modifier -int 1048576
    defaults write com.apple.dock wvous-tr-corner -int 4
    defaults write com.apple.dock wvous-tr-modifier -int 1048576
    defaults write com.apple.dock wvous-bl-corner -int 5
    defaults write com.apple.dock wvous-bl-modifier -int 1048576
    defaults write com.apple.dock wvous-br-corner -int 10
    defaults write com.apple.dock wvous-br-modifier -int 1048576

    log_info "Configuring system..."
    defaults write NSGlobalDomain AppleInterfaceStyle -string "Dark"
    defaults write NSGlobalDomain NSWindowResizeTime -float 0.001
    defaults write NSGlobalDomain NSAutomaticWindowAnimationsEnabled -bool false
    defaults write NSGlobalDomain NSNavPanelExpandedStateForSaveMode -bool true
    defaults write NSGlobalDomain NSNavPanelExpandedStateForSaveMode2 -bool true
    defaults write NSGlobalDomain NSDocumentSaveNewDocumentsToCloud -bool false
    defaults write com.apple.CrashReporter DialogType -string "none"
    defaults write com.apple.desktopservices DSDontWriteNetworkStores -bool true
    defaults write com.apple.desktopservices DSDontWriteUSBStores -bool true

    log_info "Configuring Finder extras..."
    defaults write com.apple.finder QuitMenuItem -bool true
    defaults write com.apple.finder WarnOnEmptyTrash -bool false

    log_info "Configuring trackpad..."
    defaults write com.apple.driver.AppleBluetoothMultitouch.trackpad Clicking -bool true
    defaults -currentHost write NSGlobalDomain com.apple.mouse.tapBehavior -int 1
    defaults write NSGlobalDomain com.apple.mouse.tapBehavior -int 1

    log_info "Configuring screenshots..."
    mkdir -p ~/Screenshots
    defaults write com.apple.screencapture location -string "${HOME}/Screenshots"
    defaults write com.apple.screencapture type -string "png"
    defaults write com.apple.screencapture disable-shadow -bool true

    log_info "Showing ~/Library folder..."
    chflags nohidden ~/Library

    log_info "Enabling AirDrop over Ethernet..."
    defaults write com.apple.NetworkBrowser BrowseAllInterfaces -bool true

    log_info "Restarting affected apps..."
    killall Finder
    killall Dock
    killall SystemUIServer

    log_success "Desktop-dev preset applied!"
    log_warn "Note: Keyboard repeat settings require logout to take effect."
}

verify_desktop() {
    log_section "Verifying Desktop-Dev Preset"
    local failures=0

    log_info "Checking keyboard..."
    check_default "NSGlobalDomain" "KeyRepeat" "1" "Key repeat" || ((failures++))
    check_default "NSGlobalDomain" "InitialKeyRepeat" "10" "Initial key repeat" || ((failures++))
    check_default "NSGlobalDomain" "ApplePressAndHoldEnabled" "0" "Press and hold disabled" || ((failures++))

    log_info "Checking Finder..."
    check_default "com.apple.finder" "ShowPathbar" "1" "Show path bar" || ((failures++))
    check_default "com.apple.finder" "ShowStatusBar" "1" "Show status bar" || ((failures++))
    check_default "com.apple.finder" "_FXShowPosixPathInTitle" "1" "POSIX path in title" || ((failures++))
    check_default "com.apple.finder" "FXPreferredViewStyle" "clmv" "Column view" || ((failures++))

    log_info "Checking Dock..."
    check_default "com.apple.dock" "autohide" "1" "Auto-hide" || ((failures++))
    check_default "com.apple.dock" "tilesize" "16" "Tile size" || ((failures++))
    check_default "com.apple.dock" "show-recents" "0" "Show recents" || ((failures++))

    log_info "Checking system..."
    check_default "NSGlobalDomain" "AppleInterfaceStyle" "Dark" "Dark mode" || ((failures++))

    log_info "Checking new additions..."
    check_default "com.apple.finder" "QuitMenuItem" "1" "Finder quit menu" || ((failures++))
    check_default "com.apple.driver.AppleBluetoothMultitouch.trackpad" "Clicking" "1" "Tap to click" || ((failures++))
    check_default "com.apple.screencapture" "disable-shadow" "1" "Screenshot shadow disabled" || ((failures++))

    log_info "Checking ~/Library visibility..."
    if ls -lOd ~/Library 2>/dev/null | grep -q hidden; then
        log_error "~/Library: hidden"
        ((failures++))
    else
        log_success "~/Library: visible"
    fi

    echo ""
    if [[ $failures -eq 0 ]]; then
        log_success "All desktop-dev settings verified!"
    else
        log_error "$failures setting(s) failed verification"
    fi
    return $failures
}

# ============================================
# MINIMAL PRESET
# ============================================
apply_minimal() {
    log_section "Applying Minimal Preset"
    log_info "macOS Version: $(detect_version)"

    log_info "Configuring energy (battery focus)..."
    sudo pmset -b displaysleep 2
    sudo pmset -b sleep 5
    sudo pmset -b disksleep 2
    sudo pmset -b womp 0
    sudo pmset -b powernap 0
    sudo pmset -b proximitywake 0
    sudo pmset -b tcpkeepalive 0
    sudo pmset -b lowpowermode 1

    log_info "Configuring visual effects..."
    defaults write com.apple.universalaccess reduceMotion -bool true
    defaults write com.apple.universalaccess reduceTransparency -bool true
    defaults write NSGlobalDomain NSWindowResizeTime -float 0.001
    defaults write com.apple.dock launchanim -bool false
    defaults write com.apple.dock expose-animation-duration -float 0.1
    defaults write com.apple.dock mineffect -string "scale"

    log_info "Configuring Dock..."
    defaults write com.apple.dock autohide -bool true
    defaults write com.apple.dock tilesize -int 32
    defaults write com.apple.dock show-recents -bool false
    defaults write com.apple.dock no-bouncing -bool true

    log_info "Configuring Finder..."
    defaults write com.apple.finder FXPreferredViewStyle -string "Nlsv"
    defaults write NSGlobalDomain AppleShowAllExtensions -bool true
    defaults write com.apple.finder DisableAllAnimations -bool true

    log_info "Disabling hot corners..."
    defaults write com.apple.dock wvous-tl-corner -int 0
    defaults write com.apple.dock wvous-tr-corner -int 0
    defaults write com.apple.dock wvous-bl-corner -int 0
    defaults write com.apple.dock wvous-br-corner -int 0

    log_info "Restarting affected apps..."
    killall Finder
    killall Dock
    killall SystemUIServer

    log_success "Minimal preset applied!"
}

verify_minimal() {
    log_section "Verifying Minimal Preset"
    local failures=0

    log_info "Checking energy (on battery)..."
    # Note: pmset -g shows current source settings, may vary

    log_info "Checking visual effects..."
    check_default "com.apple.universalaccess" "reduceMotion" "1" "Reduce motion" || ((failures++))
    check_default "com.apple.universalaccess" "reduceTransparency" "1" "Reduce transparency" || ((failures++))

    log_info "Checking Dock..."
    check_default "com.apple.dock" "autohide" "1" "Auto-hide" || ((failures++))
    check_default "com.apple.dock" "tilesize" "32" "Tile size" || ((failures++))
    check_default "com.apple.dock" "no-bouncing" "1" "No bouncing" || ((failures++))

    log_info "Checking Finder..."
    check_default "com.apple.finder" "FXPreferredViewStyle" "Nlsv" "List view" || ((failures++))

    echo ""
    if [[ $failures -eq 0 ]]; then
        log_success "All minimal settings verified!"
    else
        log_error "$failures setting(s) failed verification"
    fi
    return $failures
}

# ============================================
# PRESENTATION PRESET
# ============================================
apply_presentation() {
    log_section "Applying Presentation Preset"
    log_info "macOS Version: $(detect_version)"

    log_info "Starting caffeinate (prevents sleep)..."
    killall caffeinate 2>/dev/null || true
    caffeinate -di &
    echo $! > /tmp/caffeinate.pid
    log_success "Caffeinate PID: $(cat /tmp/caffeinate.pid)"

    log_info "Hiding desktop icons..."
    defaults write com.apple.finder CreateDesktop -bool false

    log_info "Configuring Dock..."
    defaults write com.apple.dock autohide -bool true
    defaults write com.apple.dock autohide-delay -float 0
    defaults write com.apple.dock autohide-time-modifier -float 0.2
    defaults write com.apple.dock tilesize -int 48
    defaults write com.apple.dock show-recents -bool false
    defaults write com.apple.dock no-bouncing -bool true

    log_info "Disabling screen saver..."
    defaults write com.apple.screensaver idleTime -int 0

    log_info "Disabling notification previews..."
    defaults write com.apple.ncprefs show_previews -int 0

    log_info "Disabling hot corners..."
    defaults write com.apple.dock wvous-tl-corner -int 0
    defaults write com.apple.dock wvous-tr-corner -int 0
    defaults write com.apple.dock wvous-bl-corner -int 0
    defaults write com.apple.dock wvous-br-corner -int 0

    log_info "Restarting affected apps..."
    killall Finder
    killall Dock
    killall NotificationCenter 2>/dev/null || true

    log_success "Presentation preset applied!"
    log_warn "To end presentation mode: ./test-preset.sh reset-presentation"
}

verify_presentation() {
    log_section "Verifying Presentation Preset"
    local failures=0

    log_info "Checking caffeinate..."
    if pgrep -q caffeinate; then
        log_success "Caffeinate: running"
    else
        log_error "Caffeinate: not running"
        ((failures++))
    fi

    log_info "Checking desktop..."
    check_default "com.apple.finder" "CreateDesktop" "0" "Desktop icons hidden" || ((failures++))

    log_info "Checking screen saver..."
    check_default "com.apple.screensaver" "idleTime" "0" "Screen saver disabled" || ((failures++))

    log_info "Checking Dock..."
    check_default "com.apple.dock" "autohide" "1" "Auto-hide" || ((failures++))
    check_default "com.apple.dock" "tilesize" "48" "Tile size" || ((failures++))

    echo ""
    if [[ $failures -eq 0 ]]; then
        log_success "All presentation settings verified!"
    else
        log_error "$failures setting(s) failed verification"
    fi
    return $failures
}

reset_presentation() {
    log_section "Resetting Presentation Mode"

    log_info "Stopping caffeinate..."
    killall caffeinate 2>/dev/null || true
    rm -f /tmp/caffeinate.pid

    log_info "Restoring desktop icons..."
    defaults write com.apple.finder CreateDesktop -bool true

    log_info "Restoring screen saver (5 min)..."
    defaults write com.apple.screensaver idleTime -int 300

    log_info "Restoring notification previews..."
    defaults write com.apple.ncprefs show_previews -int 2

    log_info "Restoring Dock defaults..."
    defaults delete com.apple.dock autohide-delay 2>/dev/null || true
    defaults delete com.apple.dock no-bouncing 2>/dev/null || true

    killall Finder Dock

    log_success "Presentation mode ended!"
}

# ============================================
# RESET TO DEFAULTS
# ============================================
reset_all() {
    log_section "Resetting to macOS Defaults"
    log_warn "This will reset all customized settings!"

    read -p "Are you sure? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Aborted."
        exit 0
    fi

    log_info "Resetting power settings..."
    sudo pmset restoredefaults

    log_info "Resetting keyboard..."
    defaults delete NSGlobalDomain KeyRepeat 2>/dev/null || true
    defaults delete NSGlobalDomain InitialKeyRepeat 2>/dev/null || true
    defaults delete NSGlobalDomain ApplePressAndHoldEnabled 2>/dev/null || true

    log_info "Resetting Finder..."
    defaults delete com.apple.finder ShowPathbar 2>/dev/null || true
    defaults delete com.apple.finder ShowStatusBar 2>/dev/null || true
    defaults delete com.apple.finder _FXShowPosixPathInTitle 2>/dev/null || true
    defaults delete com.apple.finder FXPreferredViewStyle 2>/dev/null || true
    defaults delete com.apple.finder CreateDesktop 2>/dev/null || true
    defaults delete com.apple.finder DisableAllAnimations 2>/dev/null || true

    log_info "Resetting Dock..."
    defaults delete com.apple.dock autohide 2>/dev/null || true
    defaults delete com.apple.dock autohide-delay 2>/dev/null || true
    defaults delete com.apple.dock autohide-time-modifier 2>/dev/null || true
    defaults delete com.apple.dock tilesize 2>/dev/null || true
    defaults delete com.apple.dock static-only 2>/dev/null || true
    defaults delete com.apple.dock show-recents 2>/dev/null || true
    defaults delete com.apple.dock no-bouncing 2>/dev/null || true
    defaults delete com.apple.dock launchanim 2>/dev/null || true
    defaults delete com.apple.dock mineffect 2>/dev/null || true

    log_info "Resetting hot corners..."
    defaults delete com.apple.dock wvous-tl-corner 2>/dev/null || true
    defaults delete com.apple.dock wvous-tr-corner 2>/dev/null || true
    defaults delete com.apple.dock wvous-bl-corner 2>/dev/null || true
    defaults delete com.apple.dock wvous-br-corner 2>/dev/null || true
    defaults delete com.apple.dock wvous-tl-modifier 2>/dev/null || true
    defaults delete com.apple.dock wvous-tr-modifier 2>/dev/null || true
    defaults delete com.apple.dock wvous-bl-modifier 2>/dev/null || true
    defaults delete com.apple.dock wvous-br-modifier 2>/dev/null || true

    log_info "Resetting visual effects..."
    defaults delete com.apple.universalaccess reduceMotion 2>/dev/null || true
    defaults delete com.apple.universalaccess reduceTransparency 2>/dev/null || true

    log_info "Resetting screen saver..."
    defaults delete com.apple.screensaver idleTime 2>/dev/null || true

    log_info "Stopping caffeinate..."
    killall caffeinate 2>/dev/null || true

    log_info "Restarting affected apps..."
    killall Finder Dock SystemUIServer

    log_success "Reset complete! Some settings may require logout/restart."
}

# ============================================
# VERIFY ALL
# ============================================
verify_current() {
    log_section "Current macOS Settings"
    log_info "macOS Version: $(detect_version)"

    echo ""
    log_info "=== Power Settings ==="
    pmset -g | grep -E "sleep|womp|autorestart|powernap|lowpowermode" || true

    echo ""
    log_info "=== Keyboard ==="
    echo "KeyRepeat: $(defaults read NSGlobalDomain KeyRepeat 2>/dev/null || echo 'default')"
    echo "InitialKeyRepeat: $(defaults read NSGlobalDomain InitialKeyRepeat 2>/dev/null || echo 'default')"
    echo "ApplePressAndHoldEnabled: $(defaults read NSGlobalDomain ApplePressAndHoldEnabled 2>/dev/null || echo 'default')"

    echo ""
    log_info "=== Finder ==="
    echo "ShowPathbar: $(defaults read com.apple.finder ShowPathbar 2>/dev/null || echo 'default')"
    echo "ShowStatusBar: $(defaults read com.apple.finder ShowStatusBar 2>/dev/null || echo 'default')"
    echo "FXPreferredViewStyle: $(defaults read com.apple.finder FXPreferredViewStyle 2>/dev/null || echo 'default')"
    echo "CreateDesktop: $(defaults read com.apple.finder CreateDesktop 2>/dev/null || echo 'default')"

    echo ""
    log_info "=== Dock ==="
    echo "autohide: $(defaults read com.apple.dock autohide 2>/dev/null || echo 'default')"
    echo "tilesize: $(defaults read com.apple.dock tilesize 2>/dev/null || echo 'default')"
    echo "show-recents: $(defaults read com.apple.dock show-recents 2>/dev/null || echo 'default')"

    echo ""
    log_info "=== Hot Corners ==="
    echo "Top-left: $(defaults read com.apple.dock wvous-tl-corner 2>/dev/null || echo 'default')"
    echo "Top-right: $(defaults read com.apple.dock wvous-tr-corner 2>/dev/null || echo 'default')"
    echo "Bottom-left: $(defaults read com.apple.dock wvous-bl-corner 2>/dev/null || echo 'default')"
    echo "Bottom-right: $(defaults read com.apple.dock wvous-br-corner 2>/dev/null || echo 'default')"

    echo ""
    log_info "=== Screen Saver ==="
    echo "idleTime: $(defaults read com.apple.screensaver idleTime 2>/dev/null || echo 'default')"

    echo ""
    log_info "=== Visual Effects ==="
    echo "reduceMotion: $(defaults read com.apple.universalaccess reduceMotion 2>/dev/null || echo 'default')"
    echo "reduceTransparency: $(defaults read com.apple.universalaccess reduceTransparency 2>/dev/null || echo 'default')"

    echo ""
    log_info "=== Caffeinate ==="
    if pgrep -q caffeinate; then
        echo "Status: RUNNING (PID: $(pgrep caffeinate))"
    else
        echo "Status: not running"
    fi
}

# ============================================
# USAGE
# ============================================
usage() {
    cat << EOF
macOS Settings Preset Tester

Usage: $0 <command>

Commands:
  server              Apply server preset (headless Mac Mini)
  desktop             Apply desktop-dev preset (developer workstation)
  minimal             Apply minimal preset (battery-focused)
  presentation        Apply presentation preset (meetings/demos)

  verify              Show current settings
  verify-server       Verify server preset applied correctly
  verify-desktop      Verify desktop-dev preset applied correctly
  verify-minimal      Verify minimal preset applied correctly
  verify-presentation Verify presentation preset applied correctly

  reset               Reset all settings to macOS defaults
  reset-presentation  End presentation mode only

Examples:
  $0 server           # Apply server preset
  $0 verify-server    # Check if server settings are correct
  $0 reset            # Reset everything to defaults
EOF
}

# ============================================
# MAIN
# ============================================
main() {
    if [[ $# -eq 0 ]]; then
        usage
        exit 1
    fi

    case "$1" in
        server)
            apply_server
            echo ""
            verify_server
            ;;
        desktop)
            apply_desktop
            echo ""
            verify_desktop
            ;;
        minimal)
            apply_minimal
            echo ""
            verify_minimal
            ;;
        presentation)
            apply_presentation
            echo ""
            verify_presentation
            ;;
        verify)
            verify_current
            ;;
        verify-server)
            verify_server
            ;;
        verify-desktop)
            verify_desktop
            ;;
        verify-minimal)
            verify_minimal
            ;;
        verify-presentation)
            verify_presentation
            ;;
        reset)
            reset_all
            ;;
        reset-presentation)
            reset_presentation
            ;;
        *)
            log_error "Unknown command: $1"
            usage
            exit 1
            ;;
    esac
}

main "$@"
