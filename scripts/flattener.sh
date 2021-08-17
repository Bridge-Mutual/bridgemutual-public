#!/bin/bash

for arg in "$@" do
    FILE=${arg##*/}

    truffle-flattener $arg > ./flat_contracts/$FILE
done