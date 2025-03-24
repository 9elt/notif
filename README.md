# Notif

Run a script on notifications (when their pop up disappears) on macOS Sequoia 15+

## Installation

```
$ npm i -g @9elt/notif
```

## Example usage

```shell
$ sudo chmod +x example.sh
$ notif example.sh &
```

<sub>_example.sh_</sub>

```shell
#!/bin/sh

ID="$1"
APP="$2"
TITLE="$3"
SUBTITLE="$4"
BODY="$5"
DATE="$6"

# do something ...
```
