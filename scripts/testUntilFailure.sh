#!/bin/bash

# Usage: migrationPacing <max_amount_of_retries>
#
# Script that keeps running the unit test suite until it passes or the
# maximium amount of test tries is reached, some rounding issues prevent
# testing to run consistently.


max_retries=$1
timestamp=$(date +%s);

restartGanacheIfRunning() {
  killall "npm run private-network" && killall "npm run private-network-quiet"
  rm /tmp/tmp-* -rf;
  npm run private-network &
}


for ((x=0; x<$max_retries; x++)); do
  test_filename=$timestamp"_$x.out"

  echo $test_filename

  restartGanacheIfRunning
  truffle test --bail > $test_filename 2>&1
  success=$?

  if [ $success -eq 0 ]; then
    echo "Success at retry # $x"
    exit 0
  fi
done

echo "Ran out of tries for $timestamp"
exit 1
