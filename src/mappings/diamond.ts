import {
    AavegotchiDiamond,
    AavegotchiInteract,
    BuyPortals,
    PortalOpened,
    ClaimAavegotchi,
    IncreaseStake,
    DecreaseStake,
    UseConsumables,
    SpendSkillpoints,
    EquipWearables,
    SetAavegotchiName,
    GrantExperience,
    Xingyun,
    ERC721ExecutedListing,
    ERC721ListingAdd,
    ERC721ListingCancelled,
    ERC721ListingRemoved,
    ERC1155ListingAdd,
    ERC1155ExecutedListing,
    ERC1155ListingCancelled,
    ERC1155ListingRemoved,
    Transfer,
    AddItemType,
    AddWearableSet,
    PurchaseItemsWithGhst,
    PurchaseItemsWithVouchers,
    MigrateVouchers,
    UpdateWearableSet,
    ItemTypeMaxQuantity,
    ExperienceTransfer,
    ItemModifiersSet,
    WearableSlotPositionsSet,
    MintPortals,
    UpdateERC1155Listing,
    RemoveExperience,
    UpdateItemPrice,
    GotchiLendingCancel,
    GotchiLendingExecute,
    GotchiLendingEnd,
    GotchiLendingClaim,
    GotchiLendingAdd,
    WhitelistCreated,
    WhitelistUpdated,
    ERC1155ExecutedToRecipient,
    ERC721ExecutedToRecipient,
    GotchiLendingEnded,
    GotchiLendingExecuted,
    GotchiLendingCanceled,
    GotchiLendingClaimed,
    GotchiLendingAdded,
    WhitelistAccessRightSet,
    WhitelistOwnershipTransferred,
} from "../../generated/AavegotchiDiamond/AavegotchiDiamond";
import {
    getOrCreateUser,
    getOrCreatePortal,
    getOrCreateAavegotchiOption,
    getOrCreateAavegotchi,
    updateAavegotchiInfo,
    getStatisticEntity,
    getOrCreateERC1155Listing,
    getOrCreateERC721Listing,
    updateERC1155ListingInfo,
    updateERC721ListingInfo,
    getOrCreateItemType,
    getOrCreateWearableSet,
    getOrCreateERC1155Purchase,
    updateERC1155PurchaseInfo,
    getOrCreateParcel,
    updateAavegotchiWearables,
    calculateBaseRarityScore,
    getOrCreateGotchiLending,
    updateGotchiLending,
    createOrUpdateWhitelist,
    getOrCreateClaimedToken,
    getOrCreateWhitelist,
} from "../utils/helpers/diamond";
import {
    BIGINT_ONE,
    PORTAL_STATUS_BOUGHT,
    PORTAL_STATUS_OPENED,
    PORTAL_STATUS_CLAIMED,
    BIGINT_ZERO,
    ZERO_ADDRESS,
    BLOCK_DISABLE_OLD_LENDING_EVENTS,
} from "../utils/constants";
import { Address, BigInt, log, Bytes } from "@graphprotocol/graph-ts";

import { Parcel } from "../../generated/schema";
import {
    RealmDiamond,
    MintParcel,
    ResyncParcel,
} from "../../generated/RealmDiamond/RealmDiamond";

//ERC721 Marketplace Facet

/*
-event:  ERC721ListingAdd(
        uint256 indexed listingId,
        address indexed seller,
        address erc721TokenAddress,
        uint256 erc721TokenId,
        uint256 indexed category,
        uint256 time
    );
-handler: handleERC721ListingAdd
*/

export function handleERC721ListingAdd(event: ERC721ListingAdd): void {
    let listing = getOrCreateERC721Listing(event.params.listingId.toString());
    listing = updateERC721ListingInfo(listing, event.params.listingId, event);

    if (listing.category == BigInt.fromI32(3)) {
        listing.gotchi = event.params.erc721TokenId.toString();
        let gotchi = getOrCreateAavegotchi(
            event.params.erc721TokenId.toString(),
            event
        )!;
        listing.collateral = gotchi.collateral;
        gotchi.activeListing = event.params.listingId;
        gotchi.save();
        listing.nameLowerCase = gotchi.nameLowerCase;

        // Traits for Filter in v2
        if (
            gotchi.withSetsNumericTraits != null &&
            gotchi.withSetsNumericTraits!.length == 6
        ) {
            listing.nrgTrait = BigInt.fromI32(gotchi.withSetsNumericTraits![0]);
            listing.aggTrait = BigInt.fromI32(gotchi.withSetsNumericTraits![1]);
            listing.spkTrait = BigInt.fromI32(gotchi.withSetsNumericTraits![2]);
            listing.brnTrait = BigInt.fromI32(gotchi.withSetsNumericTraits![3]);
            listing.eysTrait = BigInt.fromI32(gotchi.withSetsNumericTraits![4]);
            listing.eycTrait = BigInt.fromI32(gotchi.withSetsNumericTraits![5]);
        }
    } else if (listing.category.lt(BigInt.fromI32(3))) {
        let portal = getOrCreatePortal(event.params.erc721TokenId.toString());
        portal.activeListing = event.params.listingId;
        portal.save();
        listing.portal = event.params.erc721TokenId.toString();
    } else if (listing.category == BigInt.fromI32(4)) {
        listing.parcel = event.params.erc721TokenId.toString();

        let parcel = getOrCreateParcel(
            event.params.erc721TokenId,
            event.transaction.from,
            event.params.erc721TokenAddress,
            true
        );
        parcel.activeListing = event.params.listingId;
        listing.fudBoost = parcel.fudBoost;
        listing.fomoBoost = parcel.fomoBoost;
        listing.alphaBoost = parcel.alphaBoost;
        listing.kekBoost = parcel.kekBoost;

        listing.district = parcel.district;
        listing.size = parcel.size;

        listing.coordinateX = parcel.coordinateX;
        listing.coordinateY = parcel.coordinateY;
        listing.parcelHash = parcel.parcelHash;
    } else {
        //handle external contracts
    }

    listing.save();
}

/* -event: ERC721ExecutedListing(
        uint256 indexed listingId,
        address indexed seller,
        address buyer,
        address erc721TokenAddress,
        uint256 erc721TokenId,
        uint256 indexed category,
        uint256 priceInWei,
        uint256 time
    );
    */
//handler: handleERC721ExecutedListing

export function handleERC721ExecutedListing(
    event: ERC721ExecutedListing
): void {
    let listing = getOrCreateERC721Listing(event.params.listingId.toString());
    listing = updateERC721ListingInfo(listing, event.params.listingId, event);

    listing.buyer = event.params.buyer;
    listing.timePurchased = event.params.time;
    listing.save();

    //Portal -- update number of times traded
    if (event.params.category.lt(BigInt.fromI32(3))) {
        let portal = getOrCreatePortal(event.params.erc721TokenId.toString());
        portal.timesTraded = portal.timesTraded.plus(BIGINT_ONE);

        // add to historical prices
        let historicalPrices = portal.historicalPrices;
        if (historicalPrices == null) {
            historicalPrices = new Array();
        }
        historicalPrices.push(event.params.priceInWei);
        portal.historicalPrices = historicalPrices;
        portal.activeListing = null;
        portal.save();
    }

    //Aavegotchi -- update number of times traded
    else if (event.params.category.equals(BigInt.fromI32(3))) {
        let gotchi = getOrCreateAavegotchi(
            event.params.erc721TokenId.toString(),
            event
        )!;
        gotchi.timesTraded = gotchi.timesTraded.plus(BIGINT_ONE);

        // add to historical prices
        let historicalPrices = gotchi.historicalPrices;
        if (historicalPrices == null) {
            historicalPrices = new Array();
        }
        historicalPrices.push(event.params.priceInWei);
        gotchi.historicalPrices = historicalPrices;
        gotchi.activeListing = null;
        gotchi.save();
    } else if (event.params.category == BigInt.fromI32(4)) {
        let listing = getOrCreateERC721Listing(
            event.params.listingId.toString()
        );
        listing = updateERC721ListingInfo(
            listing,
            event.params.listingId,
            event
        );

        listing.buyer = event.params.buyer;
        listing.timePurchased = event.params.time;
        listing.save();

        //Parcel -- update number of times traded

        let parcel = getOrCreateParcel(
            event.params.erc721TokenId,
            event.params.buyer,
            event.params.erc721TokenAddress
        );
        parcel.timesTraded = parcel.timesTraded.plus(BIGINT_ONE);
        parcel.activeListing = null;
        // add to historical prices
        let historicalPrices = parcel.historicalPrices;
        if (historicalPrices == null) {
            historicalPrices = new Array();
        }
        historicalPrices.push(event.params.priceInWei);
        parcel.historicalPrices = historicalPrices;
        parcel.save();
    }

    let stats = getStatisticEntity();
    stats.erc721TotalVolume = stats.erc721TotalVolume.plus(
        event.params.priceInWei
    );
    stats.save();
}

/*
event: ERC721ListingCancelled(uint256 indexed listingId, uint256 category, uint256 time);
handler: handleERC721ListingCancelled
*/

export function handleERC721ListingCancelled(
    event: ERC721ListingCancelled
): void {
    let listing = getOrCreateERC721Listing(event.params.listingId.toString());
    listing = updateERC721ListingInfo(listing, event.params.listingId, event);

    if (listing.category.lt(BigInt.fromI32(3))) {
        let portal = getOrCreatePortal(listing.tokenId.toString());
        portal.activeListing = null;
        portal.save();
    } else if (listing.category.equals(BigInt.fromI32(3))) {
        let gotchi = getOrCreateAavegotchi(listing.tokenId.toString(), event)!;
        gotchi.activeListing = null;
        gotchi.save();
    } else if (listing.category.equals(BigInt.fromI32(4))) {
        let parcel = getOrCreateParcel(
            listing.tokenId,
            listing.seller,
            Address.fromString(listing.erc721TokenAddress.toHexString()),
            false
        );
        parcel.activeListing = null;
        parcel.save();
    }

    listing.cancelled = true;
    listing.save();
}

/*
event: ERC721ListingRemoved(uint256 indexed listingId, uint256 category, uint256 time);
handler:handleERC721ListingRemoved
*/

export function handleERC721ListingRemoved(event: ERC721ListingRemoved): void {
    let listing = getOrCreateERC721Listing(event.params.listingId.toString());
    listing = updateERC721ListingInfo(listing, event.params.listingId, event);

    if (listing.category.lt(BigInt.fromI32(3))) {
        let portal = getOrCreatePortal(listing.tokenId.toString());
        portal.activeListing = null;
        portal.save();
    } else if (listing.category.equals(BigInt.fromI32(3))) {
        let gotchi = getOrCreateAavegotchi(listing.tokenId.toString(), event)!;
        gotchi.activeListing = null;
        gotchi.save();
    } else if (listing.category.equals(BigInt.fromI32(4))) {
        let parcel = getOrCreateParcel(
            listing.tokenId,
            listing.seller,
            Address.fromString(listing.erc721TokenAddress.toHexString()),
            false
        );
        parcel.activeListing = null;
        parcel.save();
    }

    listing.cancelled = true;
    listing.save();
}

export function handleERC1155ListingAdd(event: ERC1155ListingAdd): void {
    let listing = getOrCreateERC1155Listing(
        event.params.listingId.toString(),
        true
    );

    listing = updateERC1155ListingInfo(listing, event.params.listingId, event);

    listing.save();
}

/*
-event: ERC1155ExecutedListing(
        uint256 indexed listingId,
        address indexed seller,
        address buyer,
        address erc1155TokenAddress,
        uint256 erc1155TypeId,
        uint256 indexed category,
        uint256 _quantity,
        uint256 priceInWei,
        uint256 time
    )
-handler: handleERC1155ExecutedListing
    */

export function handleERC1155ExecutedListing(
    event: ERC1155ExecutedListing
): void {
    let listing = getOrCreateERC1155Listing(event.params.listingId.toString());
    let listingUpdateInfo = event.params;

    listing = updateERC1155ListingInfo(listing, event.params.listingId, event);

    listing.save();

    //Create new ERC1155Purchase
    let purchaseID =
        listingUpdateInfo.listingId.toString() +
        "_" +
        listingUpdateInfo.buyer.toHexString() +
        "_" +
        event.block.timestamp.toString();
    let purchase = getOrCreateERC1155Purchase(
        purchaseID,
        listingUpdateInfo.buyer
    );
    purchase = updateERC1155PurchaseInfo(purchase, event);
    purchase.save();

    //Update Stats
    let stats = getStatisticEntity();
    let volume = listingUpdateInfo.priceInWei.times(
        listingUpdateInfo._quantity
    );
    stats.erc1155TotalVolume = stats.erc1155TotalVolume.plus(volume);

    if (listing.category.toI32() === 0)
        stats.totalWearablesVolume = stats.totalWearablesVolume.plus(volume);
    else if (listing.category.toI32() === 2)
        stats.totalConsumablesVolume = stats.totalConsumablesVolume.plus(
            volume
        );
    else if (listing.category.toI32() === 3)
        stats.totalTicketsVolume = stats.totalTicketsVolume.plus(volume);

    stats.save();
}

export function handleERC1155ListingCancelled(
    event: ERC1155ListingCancelled
): void {
    let listing = getOrCreateERC1155Listing(event.params.listingId.toString());

    listing = updateERC1155ListingInfo(listing, event.params.listingId, event);

    listing.save();
}

export function handleERC1155ListingRemoved(
    event: ERC1155ListingRemoved
): void {
    let listing = getOrCreateERC1155Listing(event.params.listingId.toString());

    listing = updateERC1155ListingInfo(listing, event.params.listingId, event);

    listing.save();
}
