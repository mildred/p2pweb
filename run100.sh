#!/bin/sh

now=$(date +%Y-%m-%d.%H.%M.%S)
mkdir -p data100
cd data100

forall(){
  local i=0
  local cmd="$1"
  shift
  while [ $i -lt 100 ]; do
    "$cmd" $i "$@"
    let i++
  done
}

start(){
  if [ $# -eq 0 ]; then
    forall start
    return $?
  fi
  
  while [ $# -gt 0 ]; do
  
    local i=$1
    local ii=$(printf %02d $i)
    mkdir -p data-$ii

    j=0
    while [ $j -lt 10 ]; do
      local content="$ii.$j"
      local fname=$(echo "$content" | sha1sum | cut -c-40)
      echo "$content" >data-$ii/$fname
      let j++
    done
    
    local seedargs=""
    : >seeds-$ii.txt
    local j=$(($i-5))
    local j2
    while [ $j -lt $(($i+5)) ]; do
      if [ $j -ge 100 ]; then
        j2=$(($j-100))
      elif [ $j -lt 0 ]; then
        j2=$(($j+100))
      else
        j2=$j
      fi
      printf "utp+p2pws://localhost:245%02d\n" $j2 >>seeds-$ii.txt
      seedargs="$seedargs -seed `printf "utp+p2pws://localhost:245%02d" $j2`"
      let j++
    done
    
    #echo server-cli.js -port 245$ii -data data-$ii -seedlist seeds-$ii.txt ">logserver-$ii.log"
    echo server-cli.js -port 245$ii -data data-$ii $seedargs ">logserver-$ii.log"
    ../server-cli.js -port 245$ii -data data-$ii $seedargs >server-$ii-$now.log 2>&1 &
    echo $! >server-$ii.pid
    ln -sf server-$ii-$now.log server-$ii.log
    ln -sf server-$ii-$now.log logserver-$ii.log
    
    shift
  done
}

stop(){
  if [ $# -eq 0 ]; then
    forall stop
    return $?
  fi
  
  while [ $# -gt 0 ]; do
  
    local i=$1
    local ii=$(printf %02d $i)
    
    if [ -e server-$ii.pid ]; then
      local pid=$(cat server-$ii.pid)
      if [ -e /proc/$pid ]; then
        kill $pid
      fi
      if [ -e /proc/$pid ]; then
        sleep 0.1
      fi
      if [ -e /proc/$pid ]; then
        kill $pid
      fi
      if [ -e /proc/$pid ]; then
        kill -9 $pid
      fi
      if [ -e /proc/$pid ]; then
        echo "Server $ii (PID $pid) still running" >&2
        let i++
        continue
      fi
    fi
    
    shift
  done
}

restart(){
  if [ $# -eq 0 ]; then
    forall restart
    return $?
  fi
  
  while [ $# -gt 0 ]; do
    stop "$1" && start "$1"
    shift
  done
}

case "$1" in
  start|stop|restart)
    "$@"
    ;;
  *)
    restart "$@"
    ;;
esac

