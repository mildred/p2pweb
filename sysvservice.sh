#!/bin/sh
# Autogenerated service script

### BEGIN INIT INFO
# Provides:          p2pwebserver
# Required-Start:    $local_fs $remote_fs $network $syslog $named
# Required-Stop:     $local_fs $remote_fs $network $syslog $named
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: p2pwebserver
# Description:       p2pwebserver autogenerated service managed by daemontools
### END INIT INFO

sysvservice_name="p2pwebserver"
sysvservice_exec="./server.js -port 5555"
sysvservice_once=false

if [ "$sysvservice_nested" != true ]; then

init_rundir(){
  if ! [ -e "$dir" ]; then
    mkdir "$dir"
    chmod 1755 "$dir"
    rm -f "$dir/run"
    # Avoid noexec restriction in $dir
    ln -sf "/etc/init.d/$sysvservice_name" "$dir/run"
  fi
  if ! [ -e "$dir/log" ]; then
    mkdir "$dir/log"
    chmod 1755 "$dir/log"
    rm -f "$dir/log/run"
    # Avoid noexec restriction in $dir
    ln -sf "/etc/init.d/$sysvservice_name" "$dir/log/run"
  fi
  if ! [ -p "$dir/log.pipe" ]; then
    rm -f "$dir/log.pipe"
    mkfifo "$dir/log.pipe"
  fi
}

status_q(){
  svok "$dir"     && [ up = $(svstat "$dir"     | sed -r 's/^.*:\s+(\S*)\s+.*$/\1/') ] && \
  svok "$dir/log" && [ up = $(svstat "$dir/log" | sed -r 's/^.*:\s+(\S*)\s+.*$/\1/') ]
  return $?
}

status(){
  svstat "$dir"
  svstat "$dir/log"
  status_q
  return $?
}

start(){
  if ! svok "$dir"; then
    nohup supervise "$dir" >>"$dir/log.pipe" 2>&1 &
    sleep 0.1
  fi
  if [ -d "$dir/log" ] && ! svok "$dir/log"; then
    nohup supervise "$dir/log" 2>&1 | logger -p daemon.crit -t "$sysvservice_name.log" &
    sleep 0.1
  fi
  svc -u "$dir/log"
  if $sysvservice_once; then
    svc -o "$dir"
  else
    svc -u "$dir"
  fi
}

stop(){
  svc -d "$dir"
  svc -d "$dir/log"
}

restart(){
  stop
  start
}

reload(){
  svc -h "$dir"
}

force_reload(){
  restart
}

sh_esc(){
  printf "'%s'" "$(printf %s "$1" | sed "s/'/'\"'\"'/g")"
}

_realpath(){
  if which realpath >/dev/null 2>&1; then
    realpath "$1"
  elif which python >/dev/null 2>&1; then
    python -c 'import sys, os.path; print(os.path.realpath(sys.argv[1]))' "$1"
  elif which greadlink >/dev/null 2>&1; then
    greadlink -f "$1"
  elif (readlink --version | grep "GNU coreutils") >/dev/null 2>&1; then
    readlink -f "$1"
  elif [ -d "$1" ]; then
    (cd -P "$1"; echo "$PWD")
  else
    # Incomplete as basename could be symbolic link and would not be followed
    (cd -P "`dirname "$1"`"; echo "$PWD/`basename "$1"`")
  fi
}

if [ -d /run ]; then
  rundir="/run"
else
  rundir="/var/run"
fi
dir="`_realpath "$rundir/$sysvservice_name"`"
zero="`_realpath "$0"`"
runcmd="$(cd -P "$(dirname "$0")"; echo "$PWD/$(basename "$0")")"
command="$1"

if [ "a$runcmd" = "a$dir/run" ]; then
  command="_exec"
elif [ "a$runcmd" = "a$dir/log/run" ]; then
  command="_exec_log"
fi

case "$command" in
    generate)
        if ! [ -n "$2" ]; then
        (
          echo "Usage: $0 generate CONFIG_FILE"
          echo "CONFIG_FILE is a shell script defining the variables:"
          echo "    sysvservice_name: unique identifier for the service"
          echo "    sysvservice_exec: command to execute to run the service in foreground"
          echo "    sysvservice_once: true: execute once, false: restart when the process dies"
          echo
          echo "Interactive mode"
          echo -n "sysvservice_name="
          read sysvservice_name
          echo -n "sysvservice_exec="
          read sysvservice_exec
          echo -n "sysvservice_once="
          read sysvservice_once
        ) >&2
        else
          sysvservice_nested=true
          . "$2"
        fi
        initinfo=false
        while IFS= read line; do
          if [ "${line#\#\#\# BEGIN INIT INFO}" != "$line" ]; then
            initinfo=true
            echo "$line"
          elif [ "${line#\#\#\# END INIT INFO}" != "$line" ]; then
            initinfo=false
            echo "$line"
          elif $initinfo && [ "${line#\# Provides:}" != "$line" ]; then
            echo "# Provides:          $sysvservice_name"
          elif $initinfo && [ "${line#\# Short-Description:}" != "$line" ]; then
            echo "# Short-Description: $sysvservice_name"
          elif $initinfo && [ "${line#\# Description:}" != "$line" ]; then
            echo "# Description:       $sysvservice_name autogenerated service managed by daemontools"
          elif [ "${line#sysvservice_name=}" != "$line" ]; then
            echo "sysvservice_name=`sh_esc "$sysvservice_name"`"
          elif [ "${line#sysvservice_exec=}" != "$line" ]; then
            echo "sysvservice_exec=`sh_esc "$sysvservice_exec"`"
          elif [ "${line#sysvservice_once=}" != "$line" ]; then
            echo "sysvservice_once=`sh_esc "$sysvservice_once"`"
          else
            echo "$line"
          fi
        done <"$0"
        ;;
    start|stop|restart)
        init_rundir
        $1
        ;;
    reload)
        init_rundir
        status_q || exit 7
        $1
        ;;
    force-reload)
        init_rundir
        force_reload
        ;;
    status)
        init_rundir
        status
        ;;
    condrestart|try-restart)
        init_rundir
        status_q || exit 0
        restart
        ;;
    enable)
        if which update-rc.d >/dev/null 2>&1; then
            update-rc.d $sysvservice_name defaults
        elif which chkconfig >/dev/null 2>&1; then
            chkconfig --add $sysvservice_name
        else
            echo "Could not enable $sysvservice_name" >&2
            exit 1
        fi
        ;;
    disable)
        if which update-rc.d >/dev/null 2>&1; then
            update-rc.d -f $sysvservice_name remove
        elif which chkconfig >/dev/null 2>&1; then
            chkconfig --del $sysvservice_name
        else
            echo "Could not disable $sysvservice_name" >&2
            exit 1
        fi
        ;;
    _exec)
        if [ "a${zero#/etc}" = "a$zero" ]; then
          cd "`dirname "$zero"`"
        fi
        exec $sysvservice_exec
        ;;
    _exec_log)
        mkdir -p /var/log/$sysvservice_name
        exec <"$dir/log.pipe"
        exec multilog t /var/log/$sysvservice_name
        ;;
    install-deps)
        if which apt-get >/dev/null 2>&1; then
            export DEBIAN_FRONTEND=noninteractive
            apt-get install -y daemontools
        elif which dnf >/dev/null 2>&1; then
            dnf install -y daemontools
        elif which yum >/dev/null 2>&1; then
            yum install -y daemontools
        elif which yaourt >/dev/null 2>&1; then
            yaourt -S daemontools
        else
            echo "Could not install dependencies: unknown system" >&2
            exit 1
        fi
        ;;
    install-init.d)
        ln -s "$zero" "/etc/init.d/$sysvservice_name"
        ;;
    *)
        echo "Usage: $0 {start|stop|status|restart|condrestart|try-restart|reload|force-reload}"
        echo "       $0 enable|disable"
        echo "       $0 install-deps"
        echo "       $0 install-init.d"
        echo "       $0 generate [CONFIG_FILE]"
        exit 2
esac
exit $?

fi # sysvservice_nested


