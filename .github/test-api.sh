#! /usr/bin/env bash

PORT=5000
ENDPOINT=spec

make serve-local &
server_pid=$!

sleep 3

curl --retry-connrefused --retry 10 --retry-delay 5 --fail http://127.0.0.1:$PORT/$ENDPOINT | python3 -m json.tool > /dev/null
result=$?

kill $server_pid

exit $?
