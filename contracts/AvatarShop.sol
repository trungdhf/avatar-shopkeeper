// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AvatarShop {
    uint256 public constant PRICE = 0.0001 ether;
    address payable public immutable owner;
    mapping(address => bool) public hasHat;

    event HatPurchased(address indexed buyer);

    constructor() {
        owner = payable(msg.sender);
    }

    function purchaseHat() external payable {
        require(!hasHat[msg.sender], "Already owned");
        require(msg.value == PRICE, "Incorrect price");
        hasHat[msg.sender] = true;
        emit HatPurchased(msg.sender);
    }

    function withdraw() external {
        require(msg.sender == owner, "Only owner");
        (bool sent, ) = owner.call{value: address(this).balance}("");
        require(sent, "Transfer failed");
    }
}
