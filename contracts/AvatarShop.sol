// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AvatarShop {
    uint256 public constant PRICE = 0.0001 ether;
    uint256 public constant GLASSES_PRICE = 0.0001 ether;
    // 2 = gifting: an item can be bought for another wallet. The frontend reads
    // this to decide whether to offer the gift field, so a site still pointed at
    // the version 1 deployment (which has no VERSION getter) keeps working.
    uint256 public constant VERSION = 2;
    address payable public immutable owner;
    mapping(address => bool) public hasHat;
    mapping(address => bool) public hasGlasses;

    event HatPurchased(address indexed buyer);
    event GlassesPurchased(address indexed buyer);
    event Gifted(address indexed from, address indexed to, bool hat);

    constructor() {
        owner = payable(msg.sender);
    }

    function purchaseHat() external payable {
        _hat(msg.sender);
    }

    function purchaseGlasses() external payable {
        _glasses(msg.sender);
    }

    // Gifts: the caller pays, the recipient gets the unlock. The frontend screens
    // both the paying wallet and the recipient with Intercepta before signing.
    function purchaseHatFor(address to) external payable {
        _hat(to);
        emit Gifted(msg.sender, to, true);
    }

    function purchaseGlassesFor(address to) external payable {
        _glasses(to);
        emit Gifted(msg.sender, to, false);
    }

    function _hat(address to) private {
        require(to != address(0), "Zero recipient");
        require(!hasHat[to], "Already owned");
        require(msg.value == PRICE, "Incorrect price");
        hasHat[to] = true;
        emit HatPurchased(to);
    }

    function _glasses(address to) private {
        require(to != address(0), "Zero recipient");
        require(!hasGlasses[to], "Already owned");
        require(msg.value == GLASSES_PRICE, "Incorrect price");
        hasGlasses[to] = true;
        emit GlassesPurchased(to);
    }

    function withdraw() external {
        require(msg.sender == owner, "Only owner");
        (bool sent, ) = owner.call{value: address(this).balance}("");
        require(sent, "Transfer failed");
    }
}
