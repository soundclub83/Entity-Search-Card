# Entity Search Card

A lightweight and modern search card for Home Assistant dashboards.

Originally based on the excellent `search-card` project by Pierre Ståhl, this version is independently maintained and extended with a more modern design and compatibility updates for newer Home Assistant versions.

---

## Features

- Fast entity search
- Works with modern Home Assistant versions
- No outdated frontend dependencies
- Lightweight and simple
- Automatic language detection (German / English)
- Clean integrated dashboard design
- Supports excluded domains
- Configurable result limit
- Mobile friendly layout

---

## Screenshots

### Compact Mode

![Compact Mode](images/screenshot-1.png)

### Search Results

![Search Results](images/screenshot-2.png)

---

## Installation

### HACS (Custom Repository)

Add this repository as a custom repository in HACS.

Repository type:

```text
Dashboard
```

Then install the card via HACS.

---

## Configuration

Basic example:

```yaml
type: custom:entity-search-card
```

Advanced example:

```yaml
type: custom:entity-search-card
max_results: 20
excluded_domains:
  - automation
  - script
```

---

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `max_results` | number | `20` | Maximum number of displayed results |
| `excluded_domains` | list | `[]` | Exclude specific entity domains |

---

## Example

```yaml
type: custom:entity-search-card
max_results: 15
excluded_domains:
  - automation
  - script
  - update
```

---

## Planned Features

- Domain specific controls
- Toggle switches directly in results
- Sliders for lights / covers / climate
- Media player controls
- Fuzzy search
- Keyboard navigation
- Search history
- Domain filter chips
- Improved mobile layout

---

## Credits

Original project:
https://github.com/postlund/search-card

Created by Pierre Ståhl.

This project continues development with UI improvements, compatibility fixes and additional features.

---

## License

MIT License
