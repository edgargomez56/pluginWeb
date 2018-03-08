define(() => ({
    // ---------------
    // Display options
    // ---------------
    MAX_SEARCH_ENTRIES_NUMBER: 50,
    MIN_SEARCH_REQUEST_LENGTH: 3,
    NEXT_ACTIVITIES_NUMBER: 5,


    // ----------------------------------
    // Labels of OFSC Resource properties
    // ----------------------------------

    // Resource ID. Unsaved changes will be erased if plugin is opened for Resource with other id
    RESOURCE_PROPERTY_ID: 'pid',


    // ----------------------------------
    // Labels of OFSC Activity properties
    // ----------------------------------

    // ID or serial number of meter
    ACTIVITY_PROPERTY_SEARCH_BY: 'XA_medidor',

    // Activities in the list and search results are sorted by this property
    ACTIVITY_PROPERTY_SORT: 'XA_Cons_Lect',

    // Value of meter reading are stored in this property
    ACTIVITY_PROPERTY_METER_READING: 'XA_Lectura_Le',

    // Next activities are suggested basing on this property
    ACTIVITY_PROPERTY_COMPLETION_ORDER: 'XA_completion_order',

    // Street address of activity
    ACTIVITY_PROPERTY_ADDRESS: 'caddress',

    // Status of activity in OFSC
    ACTIVITY_PROPERTY_STATUS: 'astatus',

    // Unique ID of activity
    ACTIVITY_PROPERTY_ID: 'aid',


    // --------------------------------
    // Labels of OFSC Activity statuses
    // --------------------------------

    ACTIVITY_STATUS_PENDING: 'pending',
    ACTIVITY_STATUS_STARTED: 'started',
    ACTIVITY_STATUS_DELETED: 'deleted',
    ACTIVITY_STATUS_COMPLETE: 'complete',
    ACTIVITY_STATUS_CANCELLED: 'cancelled',
    ACTIVITY_STATUS_SUSPENDED: 'suspended',
    ACTIVITY_STATUS_NOTDONE: 'notdone'
}));